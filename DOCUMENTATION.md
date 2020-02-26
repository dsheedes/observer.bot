# OBSERVER.bot Functionality documentation

## Administrator & moderator functions
### Bot configuration commands
    observer set config <field> <value>
Possible options: 
|Field|Value|Default|Description|
|-----|----|-------|------------|
|prefix|value*|<kbd>,</kbd>|Changes the prefix value|
|deleteAfterQuery|0 or 1|0|If the bot should delete a user message after query|
|defaultChannel| Channel ID|null|If a bot should send messages to a specific channel|

*prefix value should be a single character value that is not used by any other bot or discord, default is <kbd>,</kbd>*

### Bot settings commands
    ,settings <setting> <value>

|Setting|Value|Default|Description|
|-------|-----|-------|-----------|
|arole|string*|null|Sets an administrator role|
|mrole|string*|null|Sets a moderator role|
|~~monitoredDevice~~|~~all/web/mobile/desktop~~|~~all~~|~~Which devices to monitor~~|
|monitoredType|0 - 3*|0|Select which presence types to monitor|
|monitoredGames|string*|all|Select which games(activity) to monitor|
|monitoredStatus|all/(online,idle,dnd)|all|Choose which users to monitor based on their status|
|allowPlaytimeSearch|0/1|1|Choose whether users can see other users' playtimes|

*arole and mrole string values are names of administrator and moderator roles, respectively*

*Monitored presence type values are as follows:*

0. Playing
1. Streaming
2. Listening
3. Watching
### Role system settings
    ,roles <command> <option(s)>
|Command|Option(s)|Default|Description|
|-------|---------|-------|-----------|
|add|role name, xp|/|Adds a role based on role name and xp value that needs to be reached to gain the role.|
|remove|role name|/|Removes a role, if it was previously added, from the role system list|
|edit|role name, xp|/|Changes the xp value for a role|
|multiplier|decimal(0,001 - 100,000)|1|Changes the multiplier for playtimes*|
|toggle|/|0|Enables or disables the role system. Default is disabled.|

*multiplier uses a simple formula where `xp = playtime x multiplier`*
## User functions

    ,<command> <option(s)>

|Command|Option(s)|Description|
|-------|---------|-----------|
|playtime/p|*display name*|Shows current playtime statistics for user or for self if left empty.|
|top/t|limit; flags*|Shows all time top playtimes limited by limit and filtered by flags*|
|topday/td|limit(1 - 100)|Shows top playtimes for the previous day, limited by limit option.|
|topweek/tw|limit(1 - 100)| Same as previous, except it shows previous week.|
|topmonth/tm|limit(1 - 100)| Same as previous, except it shows previous month.|
|roles|/|Shows information about the role system.|

*Flags that can be used for the top list are:*
|Flag|Meaning|
|----|-------|
|-a|Activity name|
|-p|Presence type|
|~~-d~~|~~Device type~~|

*Flags should be followed by an option:*
    `,top <limit> <flag> <option>`

