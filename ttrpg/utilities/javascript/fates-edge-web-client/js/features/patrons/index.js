/* features/patrons/patrons.css */

/* ============================================================
   PATRONS LAYOUT
   ============================================================ */

.patrons-modern-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.patrons-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
}

.patrons-title {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0;
    color: var(--text);
}

.patrons-subtitle {
    font-size: 1rem;
    color: var(--text3);
    margin: 0.25rem 0 0 0;
}

/* ============================================================
   TABS
   ============================================================ */

.patrons-tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
}

.patrons-tab {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--text2);
    cursor: pointer;
    border-radius: var(--radius);
    font-size: 0.9rem;
    transition: all 0.2s;
}

.patrons-tab:hover {
    background: var(--bg2);
    color: var(--text);
}

.patrons-tab.active {
    background: var(--bg2);
    color: var(--gold);
    font-weight: 600;
}

/* ============================================================
   VIEW CONTAINER
   ============================================================ */

.patrons-view-container {
    min-height: 300px;
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

.patrons-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--text3);
    gap: 1rem;
    background: var(--bg2);
    border-radius: var(--radius);
}

/* ============================================================
   PATRON GRIDS
   ============================================================ */

.patrons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
}

.trusts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
}

.assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
}

/* ============================================================
   PATRON CARDS
   ============================================================ */

.patron-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.3rem;
}

.patron-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border-color: var(--gold);
}

.patron-card.cosmic {
    border-top: 3px solid #7c3aed;
}

.patron-card.terrestrial {
    border-top: 3px solid #f59e0b;
}

.patron-card-icon {
    font-size: 2.5rem;
    line-height: 1.2;
}

.patron-card-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
}

.patron-card-domain {
    font-size: 0.85rem;
    color: var(--text2);
}

.patron-card-type {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text3);
    background: var(--bg2);
    padding: 0.1rem 0.5rem;
    border-radius: 8px;
}

.patron-card-tier {
    font-size: 0.8rem;
    color: var(--gold);
    font-weight: 600;
}

.patron-card-location {
    font-size: 0.8rem;
    color: var(--text3);
}

.patron-card-tags {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.3rem;
}

.patron-tag {
    font-size: 0.6rem;
    padding: 0.1rem 0.5rem;
    border-radius: 8px;
    background: var(--bg2);
    color: var(--text2);
    border: 1px solid var(--border);
}

.patron-tag.rival {
    border-color: #dc2626;
    color: #dc2626;
}

/* ============================================================
   TRUST CARDS
   ============================================================ */

.trust-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.3rem;
    border-top: 3px solid #06b6d4;
}

.trust-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border-color: var(--gold);
}

.trust-card-icon {
    font-size: 2.5rem;
    line-height: 1.2;
}

.trust-card-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
}

.trust-card-tier {
    font-size: 0.8rem;
    color: var(--gold);
    font-weight: 600;
}

.trust-card-stats {
    display: flex;
    gap: 0.8rem;
    font-size: 0.8rem;
    color: var(--text2);
    flex-wrap: wrap;
    justify-content: center;
}

/* ============================================================
   ASSET CARDS
   ============================================================ */

.asset-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.2rem;
}

.asset-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border-color: var(--gold);
}

.asset-card-tier {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text3);
    background: var(--bg2);
    padding: 0.1rem 0.5rem;
    border-radius: 8px;
}

.asset-card-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text);
}

.asset-card-type {
    font-size: 0.75rem;
    color: var(--text3);
}

.asset-card-trust {
    font-size: 0.7rem;
    color: var(--text2);
}

.asset-card-cost {
    font-size: 0.8rem;
    color: var(--gold);
}

/* ============================================================
   ACTIONS
   ============================================================ */

.patrons-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
}

/* ============================================================
   MODALS
   ============================================================ */

.patron-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.modal-content {
    background: var(--bg);
    border-radius: var(--radius);
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.5rem;
    position: relative;
    border: 1px solid var(--border);
}

.modal-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    color: var(--text2);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius);
}

.modal-close:hover {
    background: var(--bg3);
    color: var(--text);
}

/* ============================================================
   PATRON DETAIL
   ============================================================ */

.patron-detail-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
}

.patron-detail-icon {
    font-size: 3rem;
    line-height: 1;
}

.patron-detail-domain {
    font-size: 0.9rem;
    color: var(--text2);
}

.patron-detail-body {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.patron-detail-section h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text2);
    margin: 0 0 0.25rem 0;
}

.patron-detail-section p,
.patron-detail-section ul {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text);
}

.patron-detail-section ul {
    list-style: none;
    padding: 0;
}

.patron-detail-section ul li {
    padding: 0.1rem 0;
    padding-left: 0.5rem;
    border-left: 2px solid var(--gold);
    margin: 0.1rem 0;
}

.patron-detail-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
}

/* ============================================================
   TRUST DETAIL
   ============================================================ */

.trust-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
}

.trust-stat {
    background: var(--bg2);
    padding: 0.5rem;
    border-radius: var(--radius);
    text-align: center;
}

.stat-label {
    font-size: 0.7rem;
    color: var(--text3);
    display: block;
}

.stat-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
}

/* ============================================================
   ASSET LIST
   ============================================================ */

.asset-list,
.follower-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.asset-list-item,
.follower-list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    background: var(--bg2);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
}

.asset-list-item:hover,
.follower-list-item:hover {
    background: var(--bg3);
}

.asset-tier-badge {
    font-size: 0.6rem;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    background: var(--bg);
    color: var(--text2);
    border: 1px solid var(--border);
}

.asset-name,
.follower-name {
    font-weight: 500;
    flex: 1;
}

.asset-type,
.follower-role {
    font-size: 0.75rem;
    color: var(--text3);
}

.follower-cap {
    font-size: 0.7rem;
    color: var(--text2);
    background: var(--bg);
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
}

.follower-state {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
}

.follower-state.Faithful {
    background: #065f46;
    color: #6ee7b7;
}

.follower-state.Strained {
    background: #78350f;
    color: #fcd34d;
}

.follower-state.Broken {
    background: #7f1d1d;
    color: #fca5a5;
}

/* ============================================================
   RESPONSIVE
   ============================================================ */

@media (max-width: 640px) {
    .patrons-grid,
    .trusts-grid,
    .assets-grid {
        grid-template-columns: 1fr 1fr;
    }
    
    .patrons-tabs {
        flex-wrap: nowrap;
        overflow-x: auto;
    }
    
    .patrons-tab {
        white-space: nowrap;
        font-size: 0.8rem;
        padding: 0.3rem 0.6rem;
    }
    
    .modal-content {
        padding: 1rem;
        max-width: 100%;
    }
}

@media (max-width: 480px) {
    .patrons-grid,
    .trusts-grid,
    .assets-grid {
        grid-template-columns: 1fr;
    }
}
