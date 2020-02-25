const Discord = require('discord.js');

const env = require("./env.json");

var mysql      = require('mysql');
var connection = mysql.createPool({
  connectionLimit : 10,
  host     : env.mysql.host,
  user     : env.mysql.user,
  password : env.mysql.password,
  database : env.mysql.database,
  insecureAuth:true
});

const client = new Discord.Client();

let scu; //Shard Client Util, will define in ready section.

let configs =  new Discord.Collection(); //Using Collection for convenience
let roles = new Discord.Collection();

function loadServerFiles(guild){
    let id = guild.id;
    getServerConfig(id).then((config) => {
        configs.set(config.server, {"prefix":config.prefix, "deleteAfterQuery":Boolean(Number(config.deleteAfterQuery)), "defaultChannel":config.defaultChannel});
        getRole(id).then((role) => {
            if(role != null){
                
                let tempRID = role.rid;
                let tempRNAME = role.name;
                let tempRXP = role.xp;

                if(tempRID == null){
                    tempRID = [];
                } else tempRID = JSON.parse(role.rid);
                if(tempRNAME == null){
                    tempRNAME = [];
                } else tempRNAME = JSON.parse(role.name);
                if(tempRXP == null){
                    tempRXP = [];
                } else tempRXP = JSON.parse(role.xp);
                roles.set(role.server, {"enabled":role.enabled, "rid":tempRID, "name":tempRNAME, "multiplier":role.multiplier,"xp":tempRXP});
            }
        }).catch((e) => console.error(e));
    }).catch(() => { //We didn't find this server in our database, so let's set it up.
        setupServer(guild);
    });
}
function setRoleMultiplier(sid, value){
    let promise = new Promise((resolve, reject) => {
        let role = roles.get(sid);
        role.multiplier = value;
        roles.set(sid, role);
        updateRoles(sid).catch((e) => {console.error("Error while updating roles.\n"+e)});
        resolve(true);
    })
    
    return promise;
}
function addXP(uid, sid, member){
    let promise = new Promise((resolve, reject) => {
        if(roles.get(sid).enabled == 1){
            let xp = 1*roles.get(sid).multiplier;

            connection.query("UPDATE user SET xp = xp+? WHERE id = ? AND server = ?", [xp, uid, sid], (error, results, fields) => {
                if(error) reject(error);
                if(results != null && results != undefined && results.affectedRows > 0){
                    //Now we need to check if they are about to hit a new role
                    connection.query("SELECT xp FROM user WHERE id = ? AND server = ?",[uid, sid], (error, results, fields) => {
                        if(error) reject(error);
                        if(results != null && results != undefined){
                            let xp = parseInt(results[0]);
                            //We need to check if the xp is enough to reach a role
                            let xpLevels = roles.get(sid).xp
                            for(let i = 0; i < xpLevels.length; i++){
                                if(xpLevels[i] <= xp){
                                    if(member.roles.get(roles.get(sid).id[i]) == undefined){
                                        member.addRole(roles.get(sid).id[i]);
                                        //Notify the member that they achieved a new role here
                                        resolve(true);
                                        return promise;
                                    }
                                }
                            }
                        }
                    });
                }
            })
        }
    });
    return promise;
}
function toggleRoles(sid){
    let promise = new Promise((resolve, reject) => {
        if(roles.get(sid) != undefined){
            let temp = roles.get(sid);
            let r = 0;
            if(temp.enabled == 0){
                temp.enabled = 1;
                r = 1;
            } else temp.enabled = 0;

            roles.set(sid, temp);
            updateRoles(sid).catch((e) => {console.error("Error while updating roles.\n"+e)});
            resolve(r);
        } else reject(false);
    });

    return promise;
}
function updateRoles(sid){
    let promise = new Promise((resolve, reject) => {
        let role = roles.get(sid);
        connection.query("UPDATE role SET enabled = ?, rid = ?, name = ?, multiplier = ?, xp = ? WHERE server = ?", [role.enabled, JSON.stringify(role.rid), JSON.stringify(role.name), role.multiplier, JSON.stringify(role.xp), sid], (error, results, fields) => {
            if(error) reject(error);
            if(results.affectedRows > 0){
                resolve(true);
            } else resolve(false);
        });
    });

    return promise;
}
function getRole(sid){
    let promise = new Promise((resolve, reject) => {
        connection.query("SELECT * FROM role WHERE server = ?", [sid], (error, results, fields) => {
            if(error) reject(error);
            if(results != null && results != undefined && results.length > 0){
                resolve(results[0]);
            } else resolve(null);
        });
    });
    return promise;
}
function editRole(sid, role){
    if(roles.get(sid) != undefined){
        let temp = roles.get(sid);
        let index = temp.indexOf(role.id);

        if(index != -1){
            temp.rid[index] = role.id;
            temp.name[index] = role.name;
            temp.xp[index] = role.xp;

            roles.set(sid, temp);
            updateRoles(sid).catch((e) => {console.error("Error while updating roles.\n"+e)});
            return true;
        } else return false;
    } else return false;
}
function removeRole(sid, role){
    if(roles.get(sid) != undefined){
        let temp = roles.get(sid);
        let index = temp.indexOf(role.id);
        if(index != -1){
            temp.rid.splice(index, 1);
            temp.name.splice(index, 1);
            temp.xp.splice(index, 1);

            roles.set(sid, temp);
            updateRoles(sid).catch((e) => {console.error("Error while updating roles.\n"+e)});
            return true;
        } else return false;
    } else return false;
}
function addRole(sid, role){
    let promise = new Promise((resolve, reject) => {
        if(roles.get(sid) != undefined){
                let temp = roles.get(sid);
                if(!temp.rid.includes(role.rid)){
                    temp.rid.push(role.rid);
                    temp.name.push(role.name);
                    temp.xp.push(role.xp);

                    roles.set(sid, temp);
                    updateRoles(sid).catch((e) => {console.error("Error while updating roles.\n"+e)});
                    return resolve(true);
                } else return resolve(false);
            } else return resolve(false);
    })
    return promise;
}
function matchRole(guild, name){
    let promise = new Promise((resolve, reject) => {
        console.log(role.name, name);
        let role = guild.roles.find((role) => role.name.toLowerCase() == name.toLowerCase())
        if(role != undefined){
            resolve(role);
        } else reject(false);
    });
    return promise;
}
function compare(u1, u2, sid){
    uid1 = u1.id;
    uid2 = u2.id;
    let promise = new Promise((resolve, reject) => {
        getPlaytime({uid:uid1}, sid).then((results) => {
            getPlaytime({uid:uid2}, sid).then((results2) => {

                let embed = {
                    "title": "Playtime comparison",
                    "description": "Comparison between `"+u1.displayName+"` and `"+u2.displayName+"`\nConcluded with the date below.",
                    "color": 1158129,
                    "timestamp": new Date(),
                    "thumbnail": {
                      "url": "https://cdn2.iconfinder.com/data/icons/circle-icons-1/64/trends-512.png"
                    },
                    "fields": [
                        {
                            "name":u1.displayName,
                            "value":"Total playtime: 0 hours",
                            "inline":true
                        },
                        {
                            "name":u2.displayName,
                            "value":"Total playtime: 0 hours",
                            "inline":true
                        },
                        {
                            "name":'\u200b',
                            "value":'\u200b'
                        }
                    ]
                }
                //We now have both results, let's match what's the same and put it in an embed file.
                if(results == null || results == undefined){
                    resolve(errorMessage("User `"+u1.displayName+"` does not have any playtime recorded."));
                    return promise;
                } else if(results2 == null || results2 == undefined){
                    resolve(errorMessage("User `"+u2.displayName+"` does not have any playtime recorded."));
                    return promise;
                }
               for(let i = 0; i < results.length; i++){
                   for(let p = 0; p < results2.length; p++){
                        if(results[i].name == results2[p].name){
                            rp = results[i].playtime/60;
                            embed.fields.push({"name":results[i].name, "value":rp.toFixed(2)+" hours.", "inline":true});
                            r2p = results2[p].playtime/60;
                            embed.fields.push({"name":results2[p].name, "value":r2p.toFixed(2)+" hours.", "inline":true});

                            embed.fields.push({"name":'\u200b', "value":'\u200b'});
                        }
                        if(i == results.length - 1){
                            resolve({embed});
                        }

                   }
               }

            });
        }).catch((error) => {
            reject(error);
        });
    });

    return promise;
}
function sendMessage(message, response, private){
    let promise = new Promise((resolve, reject) => {
        let config = configs.get(message.member.guild.id); //Get the config file for the server
        if(private){ //If the message is private
            message.author.send(response);
            resolve(true);
        } else if(config != null && config != undefined){ //If the config file is not empty
                    if(config.defaultChannel != null){ //If there is a set default channel
                        if(message.member.guild.channels.has(config.defaultChannel)){ //If the default channel exists at this time
                            message.member.guild.channels.get(config.defaultChannel).send(response).catch((e) => console.error(e));
                            resolve(true);
                        } else { //The defaultchannel is set to a nonexistent channel.
                            message.reply(response); // Send a response to current channel
                            //Now let's revert the setting to have no default channels
                            updateConfig(message.guild.id, "dc", null).then((r) => {
                                if(r){
                                    //We've updated the config, now let's notify the server owner
                                    message.guild.owner.user.send(errorMessage("Bot's default channel is not in the channel list anymore.\nI've reverted back to no default channel.\nYou should change this setting once you reconfigure your Discord server."));
                                    resolve(true);
                                }
                            })
                        }
                    } else {
                        message.reply(response);
                        resolve(true);
                    }
                } else { //Config file does not exist. We must update.

                    getServerConfig(id).then((config) => {
                        configs.set(config.server, {"prefix":config.prefix, "deleteAfterQuery":Boolean(Number(config.deleteAfterQuery)), "defaultChannel":config.defaultChannel});
                        //Let's try servicing our message again.
                        sendMessage(message, response, private);
                        resolve(true);

                    }).catch(() => { //We didn't find this server in our database, so let's set it up.
                        setupServer(guild);
                        connection.query("INSERT INTO `config` VALUES (NULL, DEFAULT, DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                                if(error) {
                                    console.error("Error while creating config for "+guild.id+" =>\n"+error)
                                    reject(false);
                                }
                                //Let's try again once we have a server in our db
                                sendMessage(message, response, private);
                                resolve(true);
                        });
                    });

                }

    });

    return promise;
}
function updateConfig(sid, setting, value){

    let promise = new Promise((resolve, reject) => {
        if(setting == 'prefix'){
            configs.set(sid, {"prefix": value, "deleteAfterQuery":configs.get(sid).deleteAfterQuery, "defaultChannel":configs.get(sid).defaultChannel}); //Updating cached configs
            connection.query("UPDATE `config` SET prefix = ? WHERE server = ?", [value, sid], function(error, results, fields){
                if(error) reject(error);
                
                if(results.affectedRows > 0)
                    resolve(true);
                else resolve(false);
             });
        } else if(setting == "daq"){
            configs.set(sid, {"prefix": configs.get(sid).prefix, "deleteAfterQuery":value, "defaultChannel":configs.get(sid).defaultChannel});
            connection.query("UPDATE `config` SET deleteAfterQuery = ? WHERE server = ?", [value, sid], function(error, results, fields){
                if(error) reject(error);
                
                if(results.affectedRows > 0)
                    resolve(true);
                else resolve(false);
             });
        }else if(setting == "dc"){
            configs.set(sid, {"prefix": configs.get(sid).prefix, "deleteAfterQuery":configs.get(sid).deleteAfterQuery, "defaultChannel":value});
            connection.query("UPDATE `config` SET defaultChannel = ? WHERE server = ?", [value, sid], function(error, results, fields){
                if(error) reject(error);
                
                if(results.affectedRows > 0)
                    resolve(true);
                else resolve(false);
             });
        }
        
    });

    return promise;


}
function matchMember(guild, value){
    let promise = new Promise((resolve, reject) => {
        guild.members.tap(member => {
            if(!member.user.bot){
                if(typeof value == "object"){
                    if(member.user.id == value.user.id){
                        resolve(member);
                    }
                } else if(member.user.username.toLowerCase() == value){
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
                    } else resolve(null);
                } resolve(null);

            });
        } else if(by.uname != null && by.uname != undefined){
            getUser({uname:by.uname}, sid).then((uid) => {
                connection.query("SELECT name, COUNT(name) AS playtime FROM `activity` WHERE user = ? AND server = ? GROUP BY name ORDER BY playtime DESC", [uid, sid], function(error, results, fields){
                    if(error) reject(error);
                    if(results != null || results != undefined){
                        if(results.length > 0){
                            resolve(results);
                        } else resolve(null);
                    }else resolve(null);
    

                });
            }).catch(() => {
                reject(null);
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


            if(results != null && results != undefined && results[0] != null && results[0] != undefined){      
                resolve(results[0]);
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
    
                if(results != null && results != undefined && results[0] != null && results[0] != undefined){      
                    resolve(results[0]);
                } else reject(undefined);
            });
        } else if(by.uname != null && by.uname != undefined){
            connection.query("SELECT * FROM `user` WHERE name = ? AND server = ?", [by.uname, sid],function(error, results, fields){
                if (error) reject(null);
    
                if(results != null && results != undefined && results[0] != null && results[0] != undefined){      
                    resolve(result);
                } else reject(undefined);
            });
        } else reject(null);
        
    });

    return promise;
}
function addUser(uid, name, sid){
    let promise = new Promise((resolve, reject) =>{
        connection.query("INSERT INTO `user` VALUES (?, ?, DEFAULT, ?, ?, DEFAULT)", [uid, name, sid, 1],function(error, results, fields){
            if (error) reject(error);
            if(results != null && results != undefined){
                if(results.affectedRows > 0) 
                    resolve(true); 
                else reject(false);
            } else reject(false);

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
        connection.query("INSERT INTO `activity` VALUES (NULL, ?, DEFAULT, ?, ?, ?, ?)", [name, type, JSON.stringify(device), sid, uid],function(error, results, fields){
            if (error) console.error(error);
        });
}
function writePlaytime(uid, sid, game, member){
    getUser({uid:uid}, sid).then( () => { //It only returns a resolve when we get a match, so this is always positive
        updatePlaytime(uid, sid).then( (r) => {
            if(r) {
                if(roles.get(sid).enabled == 1){
                    addXP(uid, sid, member).then((r) => {
                        if(!r){
                            console.warn("Something went wrong while adding xp for a user."+member.displayName);
                        }
                    }).catch((e) => {
                        console.error("Something went wrong while adding user xp:\n"+e);
                    });
                }
                addActivity(game, member.presence.game.type, member.presence.clientStatus, uid, sid);

            }
        }).catch((e) => {console.error(e)});
    }).catch( (r) =>{ //This is returned either when we find no users (r = undefined), or when we have an error (r = null)
        if(r == undefined){ //We have no user, so we better add him to the database.
            addUser(uid, member.user.username, member.guild.id).then((r) => {
                if(r){
                    addActivity(game, member.presence.game.type, member.presence.clientStatus, uid, sid);
                    addXP(uid, sid, member).then((r) => {
                        if(!r){
                            console.warn("Something went wrong while adding xp for a user.");
                        }
                    }).catch((e) => {
                        console.error("Something went wrong while adding user xp:\n"+e);
                    });
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
            }).catch((e) => {
                    connection.query("INSERT INTO `settings` VALUES (NULL, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                        if(error) console.error("Error while creating settings for "+guild.id+" =>\n"+error);
                    });
                });
        })
    }, 60000); //1 min


}
function returnPlaytime(list, author, sid){
    let embed;
    if(list != null || list != undefined){
        embed = {
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
            embed.fields.push({"name":"**"+list[i].name+"**", "value":t.toFixed(2)+" hours."});
        }
    } else {
        embed = errorMessage("No playtime detected.\nCheck back in a minute, and make sure your activity is visible.");
    }


    let promise = new Promise((resolve, reject) => {
        getUser({uid:author.id}, sid).then((user) => {
            if(list != null && list != undefined){
                let t = user.playtime/60;
                embed.fields.push({"name":"Total playtime", "value":t.toFixed(2)+" hours."});
                resolve({embed});
            } else resolve(embed)
 
        }).catch(() => {
            reject(embed);
        });
    })
    
    return promise;
}
function documentation(prefix){

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

      return {embed};
    
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
                embed.fields.push({"name":"🥇. **"+top[i].name+"**", "value":pt.toFixed(2)+" hours."});
            } else if(i == 1){
                embed.fields.push({"name":"🥈. **"+top[i].name+"**", "value":pt.toFixed(2)+" hours."});
            } else if(i == 2){
                embed.fields.push({"name":"🥉. **"+top[i].name+"**", "value":pt.toFixed(2)+" hours."});
            } else embed.fields.push({"name":i+1+". **"+top[i].name+"**", "value":pt.toFixed(2)+" hours."});
        }
    } else embed.fields.push({"name":"No results.", "value":"Tough luck. Maybe try with a different query?"});

    return {embed};
}
function setupServer(guild){
    connection.query("INSERT INTO `server` VALUES (?, ?, DEFAULT, 0, ?)", [guild.id, guild.name, guild.ownerID], function(err, results, fields){
        if(err) console.error("Error while adding a new server: "+err);
        
        if(results != null && results != undefined && results.affectedRows != null && results.affectedRows != undefined){
            connection.query("INSERT INTO `config` VALUES ('', DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                if(err) console.error("Error while creating config for "+guild.id+" =>\n"+err);
            });
            connection.query("INSERT INTO `settings` VALUES ('', DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, ?)",[guild.id], function(error, results, fields){
                if(err) console.error("Error while creating settings for "+guild.id+" =>\n"+err);
            });
            connection.query("INSERT INTO `role` VALUES (NULL, DEFAULT, ?, DEFAULT, DEFAULT, DEFAULT, DEFAULT)", [guild.id], (error, results, fields) => {
            if(error) console.error("Error while creating roles for "+guild.id+" V\n"+error);
        });
        }
    });
}
client.on('roleDelete', (role) => { //Whenever a role gets deleted we need to check if we can remove a parameter from our database
    if(roles.get(role.guild.id) != undefined){
        let guildRoles = roles.get(role.guild.id);
        let index = guildRoles.id.indexOf(role.id);
        if(index != -1){ //If it exists in our roles list
            guildRoles.rid.splice(index, 1);
            guildRoles.name.splice(index, 1);
            guildRoles.xp.splice(index, 1);

            roles.set(role.guild.id, guildRoles);
            updateRoles(role.guild.id);
            return;
        } else return;
    } else return;
});
client.on('roleUpdate', (role) =>{ //Whenever a role updates we need to check if the changes can be applied to our database aswell
    if(roles.get(role.guild.id) != undefined){
        let guildRoles = roles.get(role.guild.id);
        let index = guildRoles.id.indexOf(role.id);
        if(index != -1){ //If it exists in our roles list

            guildRoles.name = role.name;

            roles.set(role.guild.id, guildRoles);
            updateRoles(role.guild.id);

            return;
        } else return;
    } else return;
});
client.on('ready', () => {

  scu = new Discord.ShardClientUtil(client);

  console.log(`Spawned ${client.user.tag}!`);
//   Let's cache config files so we have quick access and the least amount of delay.
  client.guilds.tap(function e(guild, key, map){
    loadServerFiles(guild);
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
                    sendMessage(message, documentation(SETTINGS_PREFIX), true);
                } else if(instruction[0] == SETTINGS_PREFIX+"settings"){
        
                    if(message.guild == null){
                        sendMessage(message, errorMessage("Please use this instruction from the server chat."), true);
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
                                } else sendMessage(message, errorMessage("Cannot update monitored device. Allowed input: All, Web, Mobile, Desktop"), true);
            
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
    
                        } else {
                            sendMessage(message, errorMessage("Unknown function. Please try again."), true);
                            return;
                        }
            
                        setServerSettings(message.guild.id, settings, message);
                    } else sendMessage(message, errorMessage("Insufficient permissions."), true);
                } else if(instruction[0] == SETTINGS_PREFIX+"playtime" || instruction[0] == SETTINGS_PREFIX+"p"){
                    if(instruction[1] != null && instruction[1] != undefined){
                        //We're getting a username, let's look for it in the guild.
                        let granted = false;
                        if(!settings.allowPlaytimeSearch){ //If we are NOT allowing everyone to search for other playtimes
                            //Let's see if the user requesting a search is one of the admins/mods
                            if(message.member.roles.find(val => val.name.toLowerCase() === settings.arole) != undefined || message.member.roles.find(val => val.name.toLowerCase() === settings.mrole) != undefined || message.member.id == message.guild.ownerID){
                                granted = true;
                            } else sendMessage(message, errorMessage("Insufficient permissions."), false);
                        } else granted = true;
    
                        if(granted){
                            if(message.mentions.members != null && message.mentions.members != undefined && message.mentions.members.size > 0){
                                const iterator = message.mentions.members.values();
                                matchMember(message.guild, iterator.next().value).then((member) => {
                                    getPlaytime({uid:member.id}, message.guild.id.toString()).then((result) => {
                                        returnPlaytime(result, member.user, message.guild.id.toString()).then((r) => {
                                            sendMessage(message, r, false);
                                            return;
                                        }).catch((response) => {
                                            sendMessage(message, response, false);
                                        })
                                    }).catch(()=>{});
                                }).catch(()=>{
                                    sendMessage(message, errorMessage("Cannot find member `"+instruction[1]+"`."), false);
                                });      
                            } else {
                                matchMember(message.guild, instruction[1].toLowerCase()).then((member) => {
                                    getPlaytime({uid:member.id}, message.guild.id.toString()).then((result) => {
                                        returnPlaytime(result, member.user, message.guild.id.toString()).then((r) => {
                                            sendMessage(message, r, false);
                                            return;
                                        }).catch((response) => {
                                            sendMessage(message, response, false);
                                        })
                                    }).catch(()=>{});
                                }).catch(()=>{
                                    sendMessage(message, errorMessage("Cannot find member `"+instruction[1]+"`."), false);
                                });      
                            }
                             
                        }
                    } else {
                        getPlaytime({uid:message.author.id}, message.guild.id.toString()).then((result) => {
                            returnPlaytime(result, message.author, message.guild.id.toString()).then((r) => {
                                sendMessage(message, r, false);
                            }).catch((response) => {
                                sendMessage(message, response, false);
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
                    
                    getTop(message.guild.id.toString(), limit).then((response) => sendMessage(message, response, false)).catch((e) => console.log(e));
    
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
                        sendMessage(message, r, false);
                    }).catch((e) => {
                        if(e == null){
                           sendMessage(message, errorMessage("No results found."), false);
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
                        sendMessage(message, r, false)
                    }).catch((e) => {
                        if(e == null){
                            sendMessage(message, errorMessage("No results found."), false);
                        }else console.error(new Date.now() + " => "+e);
                    });
                } else if(instruction[0] == SETTINGS_PREFIX+"topmonth" || instruction[0] == SETTINGS_PREFIX+"tm"){
                    let limit = 10;
                    if(instruction[1] == null || instruction[1] == undefined){
                        limit = 10;
                    } else {
                        if(!isNaN(parseInt(instruction[1]))){
                            if(parseInt(instruction[1]) <= 100 && parseInt(instruction[1]) >= 0){
                                limit = parseInt(instruction[1]);
                            } 
                        }
                    }

                    getTop(message.guild.id, limit, "tm").then((r) => {
                        sendMessage(message, r, false);
                    }).catch((e) => {
                        if(e == null){
                            sendMessage(message, errorMessage("No results found."), false);
                        }else console.error(new Date.now() + " => "+e);
                    });
                } else if(instruction[0] == SETTINGS_PREFIX+"compare" || instruction[0] == SETTINGS_PREFIX+"c" || instruction[0] == SETTINGS_PREFIX+"cmp"){
                    if(instruction[1] == null || instruction[1] == undefined) {
                        sendMessage(message, errorMessage("You need to include parameters. See `"+SETTINGS_PREFIX+"help` for more information."), false);
                    } else if(instruction[2] == null || instruction[2] == undefined){
                        sendMessage(message, errorMessage("You need to include a second user. See `"+SETTINGS_PREFIX+"help` for more information."), false);
                    } else {
                        //We are in the clear!
                        let u1, u2;
                        if(message.mentions.members != null && message.mentions.members != undefined && message.mentions.members.size > 0){
                            const iterator = message.mentions.members.values();
                            matchMember(message.guild, iterator.next().value).then((result) => {
                                u1 = result;
                                matchMember(message.guild, iterator.next().value).then((result) => {
                                    u2 = result;
                                    compare(u1, u2, message.guild.id).then((response) => {
                                        sendMessage(message, response, false);
                                    }).catch((error) => {
                                        sendMessage(message, errorMessage("Something bad happened. Try again?", false))
                                    });
                                }).catch((e) => {sendMessage(message, errorMessage("Something bad happened. Try again?", false))});
                            }).catch((e) => {sendMessage(message, errorMessage("Something bad happened. Try again?", false))});
                        } else {
                        matchMember(message.guild, instruction[1]).then((result) => {
                            u1 = result;
                            matchMember(message.guild, instruction[2]).then((result) => {
                                u2 = result;
                                compare(u1, u2, message.guild.id).then((response) => {
                                    sendMessage(message, response, false);
                                }).catch((error) => {
        
                                });
                            }).catch((e) => {console.error("error");});
                        }).catch((e) => {console.error("error");});
                        }
                        

                        
                    }
                } else if(instruction[0] == SETTINGS_PREFIX+"roles"){
                            if(instruction[1] == "add"){
                                if(instruction[2] != null && instruction[2] != undefined){
                                    if(instruction[3] != null && instruction[3] != undefined && !isNaN(instruction[3])){
                                        matchRole(message.guild, instruction[2]).then((role) => {
                                            addRole(message.guild.id, {"rid":role.id, "name":role.name, "xp":instruction[3]}).then((r) => {
                                                if(r){
                                                    sendMessage(message, successMessage("Successfully added role "+role.name+", "+instruction[3]+"xp"), true);
                                                    return;
                                                } else {
                                                    sendMessage(message, errorMessage("Role already exists or something else went wrong."), true);
                                                    return;
                                                }
                                            });
                                        }).catch(() => {sendMessage(message, errorMessage("Could not find role `"+instruction[2]+"`. Please create the role first, and then use the add command."), true)});
                                    } else sendMessage(message, errorMessage("You did not input a valid value for XP"), true);
                                } else sendMessage(message, errorMessage("You did not input a valid role name."), true);
                            } else if(instruction[1] == "remove"){
                                if(instruction[2] != null && instruction[2] != undefined){
                                    matchRole(message.guild, instruction[2]).then((role) => {
                                        for(let i = 0; i < settings.roles.length; i++){
                                            if(settings.roles[i].id == role.id){
                                                removeRole(message.guild.id).then((response) => {
                                                    if(response){
                                                        sendMessage(message, successMessage("Sucessfully removed role "+role.name), true);
                                                        return;
                                                    } else {sendMessage(message, errorMessage("Could not remove role "+instruction[2]), true);return;}
                                                }).catch((e) => {console.error("Someting happened while trying to remove a role\n"+e)});
                                                
                                            }
                                        }
                                    }).catch(() => {
                                        sendMessage(message, errorMessage("Could not find role "+instruction[2]), true);
                                        return;
                                    });
                                } else sendMessage(message, errorMessage("You did not input a valid role name."), true);
                            } else if(instruction[1] == "edit"){
                                if(instruction[2] != null && instruction[2] != undefined){
                                    if(instruction[3] != null && instruction[3] != undefined && !isNaN(instruction[3])){
                                        matchRole(message.guild, instruction[2]).then((role) => {
                                            if(editRole(sid, {"rid":role.id, "name":role.name, "xp":instruction[3]})){
                                                sendMessage(message, successMessage("Successfully edited role "+role.name, true));
                                            } else sendMessage(message, errorMessage("Role does not exist or something else happened."), true);
                                        }).catch(() => {
                                            sendMessage(message, successMessage("Could not find role "+instruction[2]), true);
                                        })
                                    } else sendMessage(message, errorMessage("You did not enter a valid XP value."), true);
                                }  else sendMessage(message, errorMessage("You did not enter a valid role name."), true);
                            } else if(instruction[1] == "multiplier"){
                                if(instruction[2] != null && instruction[2] != undefined && !isNaN(instruction[2])){
                                    let value = parseFloat(instruction[2]);
                                    value = parseFloat(value.toFixed(3));

                                    if(value > 0 && value <= 100){
                                        setRoleMultiplier(message.guild.id, value).then((response) => {
                                            if(response){
                                                sendMessage(message, successMessage("Successfully set the multiplier value to "+value.toString()), true);
                                            } else sendMessage(message, errorMessage("Could not set role multiplier value."), true);
                                        }).catch((e) => {console.error("Could not set role multiplier value:\n"+e)});
                                    } else sendMessage(message, errorMessage("Multiplier can be a float value from 0,001 to 100"), true);
                                }
                            } else if(instruction[1] == "enable"){
                                toggleRoles(message.guild.id).then((response) => {
                                    if(response == 1){
                                        sendMessage(message, successMessage("Enabled role assignment."), true);
                                        return;
                                    } else{
                                        sendMessage(message, successMessage("Disabled role assignment."), true);
                                        return
                                    }
                                }).catch((e) =>{});
                            }
                            }else if(instruction[0] == ",test"){
                                console.log(instruction[1].id);
                            }
                if(SETTINGS_DELETE_AFTER_QUERY && message.guild != null){
                    message.delete()
                        .then()
                        .catch();
                }
            }).catch((e) => console.error(Date.now()+" => "+e)); 
        } else if(instruction[0] == "observer" && message.member.id == message.guild.ownerID){ //Only owners can change bot config for their server.
            if(instruction[1] == "set"){
                if(instruction[2] == "config"){
                    if(instruction[3] == "prefix"){
                        if(instruction[4] != null && instruction[4] != undefined && instruction[4].length == 1){
                            updateConfig(message.guild.id, 'prefix', instruction[4]).then((r) => {
                                sendMessage(message, successMessage("Updated config. You may use your settings now."), true);
                            }).catch((e) => {
                                console.error(e);
                            });
                        } else sendMessage(message, errorMessage("Something is not right, please try again."), false);
                    } else if(instruction[3] == "deleteafterquery"){
                        if(instruction[4] != null && instruction[4] != undefined && instruction[4].length == 1){
                            if(instruction[4] == 0 || instruction[4] == 1){
                                updateConfig(message.guild.id, 'daq', instruction[4]).then((r) => {
                                    sendMessage(message, successMessage("Updated config. You may use your settings now."), true);
                                }).catch((e) => {
                                    console.error(e);
                                });
                            } else sendMessage(message, errorMessage("You can only use 0 or 1 as a setting. 0 being false, 1 being true."), true);
                        } else sendMessage(message, errorMessage("Something is not right, please try again."), true);
                    }else if(instruction[3] == "defaultchannel"){
                        if(instruction[4] != null && instruction[4] != undefined){
                            if(message.guild.channels.has(instruction[4])){
                                updateConfig(message.guild.id, 'dc', instruction[4]).then((r) => {
                                    sendMessage(message, successMessage("Updated config. You may use your settings now."), true);
                                }).catch((e) => {
                                    console.error(e);
                                });
                            } else sendMessage(message, errorMessage("That channel does not exist. Did you use a channel name instead of channel ID?"), true);
                        } else sendMessage(message, errorMessage("Something is not right, please try again."), true);
                    }
                }
            }

        }
    }
});
client.login(env.token);
