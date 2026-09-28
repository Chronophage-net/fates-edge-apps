# Local Roll20 macros

Create these as GM macros. Install the Mod first. None connects to a socket server.

Dice pool:
```text
!fates-edge roll ?{Dice count|4}d10
```

Shuffle (resets the local deck):
```text
!fates-edge shuffle
```

Draw:
```text
!fates-edge draw ?{Cards|1|2|3|4|5}
```

Create/tick a timer:
```text
!fates-edge timer add ?{Name|doom} ?{Segments|6}
```
```text
!fates-edge timer tick ?{Name|doom} 1
```

Export the character represented by the selected token:
```text
!fates-edge export @{selected|character_id}
```
