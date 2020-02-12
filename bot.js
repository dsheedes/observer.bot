const Discord = require('discord.js');

const env = require("./env.json");

var mysql      = require('mysql');
var connection = mysql.createPool({
  connectionLimit : 10,
  host     : env.mysql.host,
  user     : env.mysql.user,
  password : env.mysql.password,
  database : env.mysql.database
});

const client = new Discord.Client();

let scu; //Shard Client Util, will define in ready section.

let configs =  new Discord.Collection(); //Using Collection for convenience

function matchMember(guild, value){
    let promise = new Promise((resolve, reject) => {
        guild.members.tap(member => {
            if(!member.user.bot){
                if(member.user.username.toLowerCase() == value){
                    resolve(member);
                } else if(member.nickname != undefined || member.nickname != null){
                    if(member.nickname.toLowerCase() == value){
                        resolve(member);
                    }
                }
            }
        });
        reject(null);
    });

    return promise;

}
function getPlaytime(by, sid){
    let promise = new Promise((resolve, reject) => {
        if(by.uid != null && by.uid != undefined){
            connection.query("SELECT name, COUNT(name) AS playtime FROM `activity` WHERE user = ? AND server = ? GROUP BY name ORDER BY playtime DESC", [by.uid, sid], function(error, results, fields){
                if(error) reject(error);

                if(results != null || results != undefined){
                    if(results.length > 0){
                        resolve(results);
                    }
                }
                resolve(null);
            });
        } else if(by.uname != null && by.uname != undefined){
            getUser({uname:by.uname}, sid).then((uid) => {
                connection.query("SELECT name, COUNT(name) AS playtime FROM `activity` WHERE user = ? AND server = ? GROUP BY name ORDER BY playtime DESC", [uid, sid], function(error, results, fields){
                    if(error) reject(error);
                    if(results != null || results != undefined){
                        if(results.length > 0){
                            resolve(results);
                        }
                    }
    
                    resolve(null);
                });
            }).catch(() => {
                resolve(null);
            });


        }
    });

    return promise;

}
function getTop(sid, limit, flag){

let promise = new Promise((resolve, reject) => {

    if(flag != null && flag != undefined){
        if(flag == "td"){
            connection.query("SELECT name, COUNT(name) AS playtime FROM `activity` WHERE server = ? AND (date >= CURDATE()-1 AND date < CURDATE()) ORDER BY playtime LIMIT ?", [sid, limit], function(error, results, fields){
                if(error) reject(error);
                console.log(results);
                if(results == null || results == undefined || results[0] == undefined || results[0].name == null){
                    reject(null);
                }
                resolve(top(results));
            });
        } else if(flag == "tw"){
            connection.query("SELECT name, COUNT(name) AS playtime FROM `activity` WHERE server = ? AND YEARWEEK(date) = YEARWEEK(NOW() - INTERVAL 1 WEEK) GROUP BY name ORDER BY playtime DESC LIMIT ?", [sid, limit], function(error, results, fields){
                if(error) reject(error);
        
                if(results == null || results == undefined || results[0] == undefined || results[0].name == undefined){
                    reject(null);
                }

                resolve(top(results));
            });
        } else if(flag == "tm"){
            connection.query("SELECT name, COUNT(*) AS name FROM `activity` WHERE server = ? AND date BETWEEN (last_day(curdate() - interval 2 month) + interval 1 day) AND last_day(curdate() - interval 1 month) GROUP BY name ORDER BY playtime DESC LIMIT ?", [sid, limit], function(error, results, fields){
                if(error) reject(error);
        
                if(results == null || results == undefined || results[0] == undefined || results[0].name == undefined){
                    reject(null);
                }

                resolve(top(results));
            });
        }
    } else {
        connection.query("SELECT name, playtime FROM `user` WHERE server = ? ORDER BY playtime DESC LIMIT ?", [sid, limit], function(error, results, fields){
            if(error) reject(error);
    
            resolve(top(results));
        });
    }
});

return promise;

}
function getServerSettings(sid){
    let promise = new Promise((resolve, reject) =>{
        connection.query("SELECT * FROM `settings` WHERE server = ?", [sid],function(error, results, fields){
            if (error) reject(error);
    
            let result = results[0];

            if(result != null && result != undefined){
                result.monitoredStatus = JSON.parse(results[0].monitoredStatus);
                result.monitoredGames = JSON.parse(results[0].monitoredGames);
                
                resolve(result);
            } else reject("Found no results.");
        });
    });

    return promise;
}
function setServerSettings(sid, settings, message){
    connection.query("UPDATE `settings` SET arole = ?, mrole = ?, monitoredDevice = ?, monitoredType = ?, allowPlaytimeSearch = ?, monitoredStatus = ?, monitoredGames = ? WHERE server = ?", [settings.arole, settings.mrole, settings.monitoredDevice, settings.monitoredType, settings.allowPlaytimeSearch, JSON.stringify(settings.monitoredStatus), JSON.stringify(settings.monitoredGames), sid], function(error, results, fields){
        if(error) console.error(new Date.now()+" => Problem while updating settings for SID: "+sid);
        message.author.send(successMessage("Updated server settings for server "+message.guild));
    });
}
function getServerConfig(sid){
    let promise = new Promise((resolve, reject) =>{
        connection.query("SELECT * FROM `config` WHERE server = ?", [sid],function(error, results, fields){
            if (error) reject(error);
            let result = results[0];

            if(result != null && result != undefined){      
                resolve(result);
            } else reject("Cannot find config for server => "+sid+"\t"+new Date());
        });
    });

    return promise;
}
function getUser(by, sid){
    let promise = new Promise((resolve, reject) =>{
        if(by.uid != null && by.uid != undefined){
            connection.query("SELECT * FROM `user` WHERE id = ? AND server = ?", [by.uid, sid],function(error, results, fields){
                if (error) reject(null);
                let result = results[0];
    
                if(result != null && result != undefined){      
                    resolve(result);
                } else reject(undefined);
            });
        } else if(by.uname != null && by.uname != undefined){
            connection.query("SELECT * FROM `user` WHERE name = ? AND server = ?", [by.uname, sid],function(error, results, fields){
                if (error) reject(null);
                let result = results[0];
    
                if(result != null && result != undefined){      
                    resolve(result);
                } else reject(undefined);
            });
        } else reject(null);
        
    });

    return promise;
}
function addUser(uid, name, sid){
    let promise = new Promise((resolve, reject) =>{
        connection.query("INSERT INTO `user` VALUES (?, ?, DEFAULT, ?, ?)", [uid, name, sid, 1],function(error, results, fields){
            if (error) resolve(error);
            if(results.affectedRows > 0) resolve(true); else resolve(false);
        });
    });

    return promise;
}
function updatePlaytime(uid, sid){
    let promise = new Promise((resolve, reject) =>{
        connection.query("UPDATE `user` SET playtime = playtime + 1 WHERE id = ? AND server = ?", [uid, sid],function(error, results, fields){
            if (error) reject(error);

            if(results.changedRows > 0) resolve(true); else resolve(false); // If updated resolve true else resolve false.
        });
    });

    return promise;
}
function addActivity(name, type, device, uid, sid){
        connection.query("INSERT INTO `activity` VALUES ('', ?, DEFAULT, ?, ?, ?, ?)", [name, type, JSON.stringify(device), sid, uid],function(error, results, fields){
            if (error) console.error(error);
        });
}
function writePlaytime(uid, sid, game, member){
    getUser({uid:uid}, sid).then( (u) => { //It only returns a resolve when we get a match, so this is always positive
        updatePlaytime(uid, sid).then( (r) => {
            if(r) addActivity(game, member.presence.game.type, member.presence.clientStatus, uid, sid);
        }).catch((e) => {console.error(e)});
    }).catch( (r) =>{ //This is returned either when we find no users (r = undefined), or when we have an error (r = null)
        if(r == undefined){ //We have no user, so we better add him to the database.
            addUser(uid, member.user.username, member.joinedTimestamp, member.guild.id).then((r) => {
                if(r){
                    addActivity(game, member.presence.game.type, member.presence.clientStatus, uid, sid);
                }
            }).catch((e) => {console.error(e)});
        } else { //We have an error, so we can just console err it.
            console.error(r);
        }
    } );
}
function watch(client){

    //What's it supposed to do:
    //Go through all guilds
    //Write down who's playing what, add 1 minute to playtime. - Based off of guild settings
    //Save the data in server files
    //Repeat after 1 minute

    setInterval(function(){
        client.guilds.tap(function(guild){
            getServerSettings(guild.id.toString()).then((settings) => {
                guild.members.tap(function(member){
                    if(!member.user.bot && member.presence.status != "offline"){ //We do not want to include ourselves or other bots
                        let status = settings.monitoredStatus;
                        if(status.includes(member.presence.status)){
                            if(member.presence.game != null || member.presence.game != undefined){
                                let write = false;
                                if(settings.monitoredDevice == "all"){
                                    write = true;
                                } else if(member.presence.clientStatus.toString() == settings.monitoredDevice){
                                   write = true;
                                }
                                if(settings.monitoredType == "any"){
                                    write = true;
                                } else if(settings.monitoredType = "playing"){
                                    if(member.presence.game.type == 0){
                                        write = true;
                                    } else write = false;
                                } else if(settings.monitoredType = "streaming"){
                                    if(member.presence.game.type == 1){
                                        write = true;
                                    } else write = false;
                                }else if(settings.monitoredType = "listening"){
                                    if(member.presence.game.type == 2){
                                        write = true;
                                    } else write = false;
                                }else if(settings.monitoredType = "watching"){
                                    if(member.presence.game.type == 3){
                                        write = true;
                                    } else write = false;
                                }
                
                                let actualWrite = false;
            
                                if(write){
                                    if(settings.monitoredGames.length > 0){
                                        let game = member.presence.game.name;
                                        if(settings.monitoredGames.includes(game)){
                                            actualWrite = true;
                                        } else actualWrite = false;
                
                                    } else actualWrite = true;
                                }
                
                                if(actualWrite){
                                            
                                    writePlaytime(member.id.toString(), guild.id.toString(), member.presence.game.name, member);
                
                                }
                            }    
                        }
    
                    }
                });
            }).catch((e) => {console.error(Date.now()+", SID: "+guild.id.toString()+" => "+e)});
        })
    }, 60000); //1 min


}
function returnPlaytime(list, author, sid){
    let embed = {
        "title": "Total playtime:",
        "description": "All time statistics for user "+author+" concluded with the date below.",
        "color": 1158129,
        "timestamp": new Date(),
        "thumbnail": {
          "url": "https://cdn2.iconfinder.com/data/icons/circle-icons-1/64/trends-512.png"
        },
        "fields": [
        ]
    }

    for(i = 0; i < list.length; i++){
        let t = list[i].playtime/60
        embed.fields.push({"name":list[i].name, "value":t.toFixed(2)+" hours."});
    }

    let promise = new Promise((resolve, reject) => {
        getUser({uid:author.id}, sid).then((user) => {
            let t = user.playtime/60;
            embed.fields.push({"name":"Total playtime", "value":t.toFixed(2)+" hours."});
            resolve({embed});
        }).catch(() => {
            reject({embed});
        });
    })
    
    return promise;
}
function documentation(prefix, author){

    const embed = {
        "title": "Documentation",
        "description": "Hopefully it's gonna be easier after reading this.",
        "color": 1158129,
        "timestamp": new Date(),
        "thumbnail": {
          "url": "https://cdn2.iconfinder.com/data/icons/circle-icons-1/64/clipboard-512.png"
        },
        "fields": [
            {
                "name":"Prefix",
                "value":"The current prefix is `"+prefix+"` "
            },
            {
            "name": "Settings - *This is reserved for privileged users* ",
            "value": "`settings <instruction> <parameters>`\n\n**Types of instructions**\n`arole <name of role>` - The name of your administrator role.\n\n`mrole <name of role>` - The name of your moderator role\n\n`monitoredDevice <all/mobile/web/desktop>` - The type of device that will be monitored\n\n`monitoredType <any/playing/listening/watching/streaming>` - Type of activity\n\n`monitoredGames <string>` - Name of monitored activity, can be multiple - separated by `;`"
            },
            {
            "name": "Main bot functions",
            "value": "`playtime <username/nickname>` - Get playtime statistics. If parameter is left empty returns personal statistics. Displaying other user statistics can be restricted in settings.\n\n`top <limit>` - returns members who played the most. If no limit is inserted returns top 10. Maximum limit is 100.\n\n`topday <limit>` - similar to previous, returns top for the previous day.\n\n`topweek <limit>` - similar to previous, returns top for the previous week.\n\n`topmonth <limit>` - similar to previous, returns top for the previous month."
            }
        ]
      };

      author.send({embed});
    
}
function successMessage(message){
    const embed = {
        "title": "Success!",
        "description": message,
        "color": 13632027,
        "timestamp": new Date(),
        "thumbnail": {
          "url": "https://i.imgur.com/BMxOrjt.png"
        },
        "fields": [
          
        ]
    }      
    
    return {embed};
}
function errorMessage(message){
    const embed = {
        "title": "Error!",
        "description": message,
        "color": 13632027,
        "timestamp": new Date(),
        "thumbnail": {
          "url": "https://cdn2.iconfinder.com/data/icons/circle-icons-1/64/caution-512.png"
        },
        "fields": [
          
        ]
    }      
    
    return {embed};
}
function top(top, flagText){
    if(flagText == undefined || flagText == null)
        flagText = "";

    let embed = {
        "title": "All time top players:",
        "description": flagText+"Concluded with the date below.\n",
        "color": 16312092,
        "timestamp": new Date(),
        "thumbnail": {
          "url": "https://cdn2.iconfinder.com/data/icons/circle-icons-1/64/trophy-512.png"
        },
        "fields": []
      }

    if(top.length > 0){
        for(i = 0; i < top.length; i++){
            let pt = top[i].playtime/60;
            if(i == 0){
                embed.fields.push({"name":"🥇. "+top[i].name, "value":pt.toFixed(2)+" hours."});
            } else if(i == 1){
                embed.fields.push({"name":"🥈. "+top[i].name, "value":pt.toFixed(2)+" hours."});
            } else if(i == 2){
                embed.fields.push({"name":"🥉. "+top[i].name, "value":pt.toFixed(2)+" hours."});
            } else embed.fields.push({"name":i+1+". "+top[i].name, "value":pt.toFixed(2)+" hours."});
        }
    } else embed.fields.push({"name":"No results.", "value":"Tough luck. Maybe try with a different query?"});

    return {embed};
}
function setupServer(guild){
    connection.query("INSERT INTO `server` VALUES (?, ?, DEFAULT, 0, ?)", [guild.id, guild.name, guild.ownerID], function(err, results, fields){
        if(err) console.error("Error while adding a new server: "+err);
        
        if(results.affectedRows != null && results.affectedRows != undefined){
            connection.query("INSERT INTO `config` VALUES ('', DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                if(err) console.error("Error while creating config for "+guild.id+" =>\n"+err);
            });
            connection.query("INSERT INTO `settings` VALUES ('', DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                if(err) console.error("Error while creating settings for "+guild.id+" =>\n"+err);
            });
        }
    });
}
client.on('ready', () => {

  scu = new Discord.ShardClientUtil(client);

  console.log(`Logged in as ${client.user.tag}!`);
//   Let's cache config files so we have quick access and the least amount of delay.
  client.guilds.tap(function e(guild, key, map){
    var id = guild.id.toString();

    getServerConfig(id).then((config) => {
        configs.set(config.server, {"prefix":config.prefix, "deleteAfterQuery":Boolean(Number(config.deleteAfterQuery))});
    }).catch(() => { //We didn't find this server in our database, so let's set it up.
        setupServer(guild);
    });
  });

  //Let's set a presence, and let everyone know what's up

  client.user.setPresence({ game: { name: 'user activity.', type:3, details:"Hello world!"}, status: 'online' })
  .then()
  .catch();

  watch(client); //Our main watch function
});
client.on("guildCreate", g => { //Create folders and files when we join a server
    setupServer(g);
});
client.on("guildDelete", g => {
    connection.query("DELETE FROM `server` WHERE id = ?",[g.id], function(error, results, fields){
        if(error) console.error(new Date().now()+" => There was an issue while deleting SID: "+g.id.toString()+" from the database");
        else console.log(new Date().now()+"SID: "+g.id.toString()+" left.");
    });
});
client.on('message', message => {
    if(!message.system){
        let instruction = message.content.toLowerCase().trim().split(" ");

        var SETTINGS_PREFIX = ",";
        var SETTINGS_DELETE_AFTER_QUERY = false;
        if(message.guild != null){
    
            var config = configs.get(message.guild.id.toString());
    
            if(config != null && config != undefined){
                SETTINGS_PREFIX = config.prefix;
                SETTINGS_DELETE_AFTER_QUERY = config.deleteAfterQuery;
            }
        }
    
        if(instruction[0][0] == SETTINGS_PREFIX){
            getServerSettings(message.guild.id).then((settings) => {
                if(instruction[0] == SETTINGS_PREFIX+"doc" || instruction[0] == SETTINGS_PREFIX+"documentation" || instruction[0] == SETTINGS_PREFIX+"help" || instruction[0] == SETTINGS_PREFIX+"man" ||  instruction[0] == SETTINGS_PREFIX+"manual"){
                    documentation(SETTINGS_PREFIX, message.author);
                } else if(instruction[0] == SETTINGS_PREFIX+"settings"){
        
                    if(message.guild == null){
                        message.author.send(errorMessage("Please use this instruction from the server chat."));
                        return;
                    }
                    if(message.member.roles.find(val => val.name.toLowerCase() === settings.arole) != undefined || message.member.roles.find(val => val.name.toLowerCase() === settings.mrole) != undefined || message.member.id == message.guild.ownerID){
                        if(instruction[1] == "arole"){
                            if(instruction[2] != null && instruction[2] != undefined){
                                settings.arole = instruction[2];
                            }
                        } else if(instruction[1] == "mrole"){
                            if(instruction[2] != null && instruction[2] != undefined){
                                settings.mrole = instruction[2];
                            }
                        } else if(instruction[1] == "monitoreddevice"){
                            if(instruction[2] != null && instruction[2] != undefined){
            
                                if(instruction[2] == "all" || instruction[2] == "web" || instruction[2] == "mobile" || instruction[2] == "desktop"){
                                    settings.monitoredDevice = instruction[2];
                                } else message.author.send(errorMessage("Cannot update monitored device. Allowed input: All, Web, Mobile, Desktop"));
            
                            }
                            
                        } else if(instruction[1] == "monitoredtype"){
                            if(instruction[2] != null && instruction[2] != undefined){
                                settings.monitoredType = instruction[2];
                            }
                        } else if(instruction[1] == "monitoredgames"){
                            if(instruction[2] != null && instruction[2] != undefined){
                                var games = message.content.trim().toLowerCase();
                                games = games.substr(25);
            
                                games = games.split(";");
            
                                settings.monitoredGames = games;
                            } else settings.monitoredGames = [];
                        } else if(instruction[1] == "monitoredStatus"){
                            if(instruction[2] != null && instruction[2] != undefined){
                                let values = [];
                                if(instruction[2].includes("all")){
                                    values.push("online");
                                    values.push("idle");
                                    values.push("dnd");
                                }else {
                                    if(instruction[2].includes("online")){
                                        values.push("online");
                                    }
        
                                    if(instruction[2].includes("idle")){
                                        values.push("idle");
                                    }
        
                                    if(instruction[2].includes("dnd")){
                                        values.push("dnd");
                                    }
                                }
    
                                if(values.length > 0){
                                    settings.monitoredStatus = values;
                                }
                            }
    
                        }else {
                            message.author.send(errorMessage("Unknown function. Please try again."));
                        }
            
                        setServerSettings(message.guild.id, settings, message);
                    } else message.author.send(errorMessage("Insufficient permissions."));
                } else if(instruction[0] == SETTINGS_PREFIX+"playtime" || instruction[0] == SETTINGS_PREFIX+"p"){
                    if(instruction[1] != null && instruction[1] != undefined){
                        //We're getting a username, let's look for it in the guild.
                        let granted = false;
                        if(!settings.allowPlaytimeSearch){ //If we are NOT allowing everyone to search for other playtimes
                            //Let's see if the user requesting a search is one of the admins/mods
                            if(message.member.roles.find(val => val.name.toLowerCase() === settings.arole) != undefined || message.member.roles.find(val => val.name.toLowerCase() === settings.mrole) != undefined || message.member.id == message.guild.ownerID){
                                granted = true;
                            } else message.reply(errorMessage("Insufficient permissions."));
                        } else granted = true;
    
                        if(granted){
                            matchMember(message.guild, instruction[1].toLowerCase()).then((member) => {
                                getPlaytime({uid:member.id}, message.guild.id.toString()).then((result) => {
                                    returnPlaytime(result, member.user, message.guild.id.toString()).then((r) => {
                                        message.reply(r);
                                        return;
                                    }).catch(() => {
                                        message.reply(errorMessage("Well, something went wrong. Try again in a minute?"));
                                    })
                                }).catch(()=>{});
                            }).catch(()=>{
                                message.reply(errorMessage("Cannot find member `"+instruction[1]+"`."))
                            });       
                        }
                    } else {
                        getPlaytime({uid:message.author.id}, message.guild.id.toString()).then((result) => {
                            returnPlaytime(result, message.author, message.guild.id.toString()).then((r) => {
                                message.reply(r);
                            }).catch(() => {
                                message.reply(errorMessage("Well, something went wrong. Try again?"));
                            })
                        }).catch(()=>{});
                    }
                } else if(instruction[0] == SETTINGS_PREFIX+"top" || instruction[0] == SETTINGS_PREFIX+"t"){
    
                    //Looking for flags
    
                    // else if(fi.includes(" -d ")){ //Device type
                    //     let activity = message.content.toLowerCase().trim().split("-d ");
                    //     activity = activity[1];
    
                    //     flag = {"mode":"-d", "name":activity};
                    // }
    
                        let fi = message.content.toLowerCase().trim();
                        if(fi.includes(" -a ")){ //Activity name / Game name
                            let activity = message.content.toLowerCase().trim().split("-a ");
                            activity = activity[1];
    
                            flag = {"mode":"-a", "name":activity};
                        }else if(fi.includes(" -p ")){ //Presence type
                            let activity = message.content.toLowerCase().trim().split("-p ");
                            activity = activity[1];
    
                            flag = {"mode":"-p", "name":activity};
                        }
                    let limit = 10;
                    if(instruction[1] == null && instruction[1] == undefined){ //If using the default limit (10)
                        limit = 10;
                    } else { //When using a custom limit(100 max)
                        if(!isNaN(parseInt(instruction[1]))){
                            if(parseInt(instruction[1]) <= 100 && parseInt(instruction[1]) >= 0){
                                limit = parseInt(instruction[1]);
                            } 
                        }
                    }
                    
                    getTop(message.guild.id.toString(), limit).then((response) => message.reply(response)).catch((e) => console.log(e));
    
                }else if(instruction[0] == SETTINGS_PREFIX+"topday" || instruction[0] == SETTINGS_PREFIX+"td"){
                    let limit = 10;
                    if(instruction[1] == null && instruction[1] == undefined){
                        limit = 10;
                    } else {
                        if(!isNaN(parseInt(instruction[1]))){
                            if(parseInt(instruction[1]) <= 100 && parseInt(instruction[1]) >= 0){
                                limit = parseInt(instruction[1]);
                            } 
                        }
                    }

                    getTop(message.guild.id, limit, "td").then((r) => {
                        message.reply(r)
                    }).catch((e) => {
                        if(e == null){
                            message.reply(errorMessage("No results found."));
                        }else console.error(new Date.now() + " => "+e);
                    });
                } else if(instruction[0] == SETTINGS_PREFIX+"topweek" || instruction[0] == SETTINGS_PREFIX+"tw"){
                    let limit = 10;
                    if(instruction[1] == null && instruction[1] == undefined){
                        limit = 10;
                    } else {
                        if(!isNaN(parseInt(instruction[1]))){
                            if(parseInt(instruction[1]) <= 100 && parseInt(instruction[1]) >= 0){
                                limit = parseInt(instruction[1]);
                            } 
                        }
                    }

                    getTop(message.guild.id, limit, "tw").then((r) => {
                        message.reply(r)
                    }).catch((e) => {
                        if(e == null){
                            message.reply(errorMessage("No results found."));
                        }else console.error(new Date.now() + " => "+e);
                    });
                } else if(instruction[0] == SETTINGS_PREFIX+"topmonth" || instruction[0] == SETTINGS_PREFIX+"tm"){
                    let limit = 10;
                    if(instruction[1] == null && instruction[1] == undefined){
                        limit = 10;
                    } else {
                        if(!isNaN(parseInt(instruction[1]))){
                            if(parseInt(instruction[1]) <= 100 && parseInt(instruction[1]) >= 0){
                                limit = parseInt(instruction[1]);
                            } 
                        }
                    }

                    getTop(message.guild.id, limit, "tm").then((r) => {
                        message.reply(r)
                    }).catch((e) => {
                        if(e == null){
                            message.reply(errorMessage("No results found."));
                        }else console.error(new Date.now() + " => "+e);
                    });
                }
                if(SETTINGS_DELETE_AFTER_QUERY && message.guild != null){
                    message.delete()
                        .then()
                        .catch();
                }
            }).catch((e) => console.error(Date.now()+" => "+e)); 
        }
    }
});
client.login(env.token);