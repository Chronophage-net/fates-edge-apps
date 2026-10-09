/** Room admission is separate from transport connectivity. Credentials stay in memory. */
export function createSocketIOSession(socket, { timeoutMs = 10000, onReady = () => {}, onNotReady = () => {}, onError = () => {} } = {}) {
    let pending = null;
    let savedJoin = null;
    let disposed = false;
    const finish = (error, data) => {
        if (!pending) return;
        const request = pending;
        pending = null;
        clearTimeout(request.timer);
        if (error) request.reject(error);
        else request.resolve(data);
    };
    const joined = data => {
        if (!pending || !data?.room) return;
        onReady(data);
        finish(null, data);
    };
    const failed = data => {
        // This warning is followed by successful admission as a Player.
        if (!pending || data?.code === 'GM_CONFLICT') return;
        savedJoin = null;
        onNotReady('disconnected');
        finish(Object.assign(new Error(data?.message || 'Room admission failed'), { code: data?.code }));
    };
    const disconnected = () => {
        onNotReady('disconnected');
        finish(new Error('Disconnected before room admission'));
    };
    const connected = () => {
        onNotReady();
        if (savedJoin) join(savedJoin.code, savedJoin.data).catch(onError);
    };
    function join(code, data = {}) {
        if (disposed || !socket.connected) return Promise.reject(new Error('Not connected'));
        if (pending) return Promise.reject(new Error('A room join is already in progress'));
        if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(code.trim())) return Promise.reject(new Error('Invalid room code'));
        code = code.trim().toUpperCase();
        savedJoin = { code, data: { ...data } };
        onNotReady();
        return new Promise((resolve, reject) => {
            pending = { resolve, reject, timer: setTimeout(() => {
                savedJoin = null;
                finish(new Error('Join room timeout'));
                // No request IDs in this protocol: close to exclude late acknowledgements.
                socket.disconnect();
            }, timeoutMs) };
            socket.emit('join-room', {
                roomCode: code,
                playerName: data.name || 'Player',
                playerRole: data.role || 'player',
                playerEmail: data.email || '',
                password: data.password || '',
                authToken: data.authToken || undefined,
            });
        });
    }
    socket.on('connect', connected);
    socket.on('disconnect', disconnected);
    socket.on('room-joined', joined);
    socket.on('error', failed);
    return {
        join,
        leave() {
            const joining = !!pending;
            savedJoin = null;
            finish(new Error('Room join cancelled'));
            onNotReady('disconnected');
            // A pending join may complete later; disconnect in that case instead.
            if (joining) socket.disconnect();
            else if (socket.connected) socket.emit('leave-room');
        },
        dispose() {
            disposed = true;
            savedJoin = null;
            finish(new Error('Connection replaced or closed'));
            socket.off('connect', connected);
            socket.off('disconnect', disconnected);
            socket.off('room-joined', joined);
            socket.off('error', failed);
        },
    };
}
