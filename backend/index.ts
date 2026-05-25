import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";

type Exercise = {
    name: string,
    points: number
};

type Config = {
    dataDir: string;
    keepInCacheTime: number,
    saveInterval: number,
    exTypes: {[internalName: string]: Exercise};
};

type DayRecord = {
    reps: {[name: string]: number},
    points: number,
    weight: number
};

//users only exist in the context of a group and do not have their own auth
type User = {
    name: string,
    records: {[date: string]: DayRecord}
};

type Group = {
    groupCode: string,
    groupPassHash: string,

    adminUser: string,
    users: { [name: string]: User; },

    lastUpdated: number
};

type GroupToken = {
    group: string;
    username: string;
    expires: number;
};

let config: Config = {
    dataDir: process.env.HOME + "/.local/share/fatass",
    keepInCacheTime: 3600000,
    saveInterval: 1800000,
    exTypes: {
        "pushup": {
            name: "Pushup",
            points: 1
        }
    }
};

//using synchronous io because it runs once at the beginning and thats it

if(fs.existsSync("$HOME/.config/fatass-api/config.json")) {
    const data = fs.readFileSync(process.env.HOME + "/.config/fatass-api/config.json", "utf8");
    config = JSON.parse(data);
    //check config dir?
} else {
    fs.mkdirSync(process.env.HOME + "/.config/fatass", {recursive: true});
    fs.writeFileSync(process.env.HOME + "/.config/fatass/config.json", JSON.stringify(config, null, 2));
}

//ensure data directory exists and is valid
if(!path.isAbsolute(config.dataDir)) {
    console.error("Data Dir \"" + config.dataDir + "\" is not an absolute path!");
    process.exit(78);
}
fs.mkdirSync(config.dataDir + "/groups", {recursive: true});

//real stuff
const app = express();

app.use(express.json());

let groupCache: { [name: string]: Group; } = {};

let groupTokens: {[usertoken: string]: GroupToken; } = {};

function getGroup(groupCode: string, callback: (group: Group | null) => void): void {
    if(groupCode in groupCache) {
        callback(groupCache[groupCode]);
    } else {
        let all = fs.readdirSync(config.dataDir + "/groups");
        if(all.includes(groupCode + ".json")) {
            fs.readFile(config.dataDir + "/groups/" + groupCode + ".json", (err, data) => {
                if(err) {
                    console.error(`Could not load apparently existing group ${groupCode}: ${err}`);
                    callback(null);
                } else {
                    let group = JSON.parse(data.toString("utf8"));
                    groupCache[groupCode] = group;
                    callback(group);
                }
            });
        } else {
            callback(null);
        }
    }
}

function saveCache(onDone: () => void = () => {}) {
    let inProgress = 0;
    let canOnDone = false;
    for(let groupCode in groupCache) {
        inProgress++;
        fs.writeFile(config.dataDir + "/groups/" + groupCode + ".json", JSON.stringify(groupCache[groupCode]), (err) => {
            if(err) {
                console.error(`Could not save group ${groupCode}: ${err}`);
            } else if(Date.now() - groupCache[groupCode].lastUpdated > config.keepInCacheTime) {
                delete groupCache[groupCode];
            }
            inProgress--;
            if(inProgress == 0 && canOnDone) { //just in case it does them synchronously or something
                onDone();
            }
        });
    }
    if(inProgress == 0) {
        onDone();
    }
    canOnDone = true;
}

app.post("/create/", (req, res) => {
	let groupCode: string = req.body.groupCode.toLowerCase();
    let groupPass: string = req.body.groupPass;
    if(groupCode.match("^([0-9]|[a-z])+([0-9a-z]+)$") == null || groupCode.length > 32) {
        res.send({code: 3, error: `Group code must be alphanumeric and between 2 and 32 characters`});
    } else {
        getGroup(groupCode, (group) => {
            if(group != null) {
                res.send({code: 2, error: `Group \"${groupCode}\" already exists`});
            } else {
                bcrypt.hash(groupPass, 10).then((hash) => {
                    groupCache[groupCode] = {groupCode: groupCode, groupPassHash: hash, adminUser: "", users: {}, lastUpdated: Date.now()};
                    console.log(`[${new Date().toISOString()}] Created group ${groupCode}`);
                    res.send({code: 0});
                }, (err) => {
                    console.error(`Could not generate hash, err: ${err}`);
                    res.send({code: -1, error: "Internal Server Error"});
                });
            }
        });
    }
});

app.post("/groupinfo/", (req, res) => {
	getGroup(req.body.groupCode.toLowerCase(), (group) => {
		if(group) {
			res.send({code: 0, group: group});
		} else {
			res.send({code: 1, error: "Group does not exist"});
		}
	});
});

app.post("/login/", (req, res) => {
    let username: string = req.body.username;
    let groupCode: string = req.body.groupCode.toLowerCase();
    let groupPass: string = req.body.groupPass;
    getGroup(groupCode, (group) => {
        if(group == null) {
            res.send({code: 1, error: "Group does not exist"});
        } else {
            bcrypt.compare(groupPass, group.groupPassHash).then((valid) => {
                if(valid) {
                    if(!(username in group.users)) {
                        group.users[username] = {name: username, records: {}};
                    }
                    const token = new Uint32Array(1);
                    crypto.getRandomValues(token);
                    groupTokens[token[0].toString(16)] = {group: group.groupCode, username: username, expires: Date.now() + 1000*60*60*24};
                    res.send({code: 0, token: token[0].toString(16)});
                } else {
                    res.send({code: 4, error: "Incorrect group password"});
                }
            }, (err) => {
                console.error(`Could not check hash, err: ${err}`);
                res.send({code: -1, error: "Internal Server Error"});
            });
        }
    });
});

app.post("/addreps/", (req, res) => {
    let token: string = req.body.token;
    let exType: string = req.body.extype;
    let reps: number = req.body.reps;
    let date: string = req.body.date; //dd-mm-yyyy

    if(!(exType in config.exTypes)) {
        res.send({code: 6, error: "Exercise type does not exist"});
    } else if(!date.match("[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}")) {
        res.send({code: 7, error: "Invalid date"});
    } else if(token in groupTokens) {
        let groupToken = groupTokens[token];
        getGroup(groupToken.group, (group) => {
            if(group == null) {
                res.send({code: 1, error: "Group does not exist"});
            } else {
                if(!(date in group.users[groupToken.username].records)) {
                    group.users[groupToken.username].records[date] = {reps: {}, points: 0, weight: -1};
                    for(let type in config.exTypes) {
                        group.users[groupToken.username].records[date].reps[type] = 0;
                    }
                }
                group.users[groupToken.username].records[date].reps[exType] += reps;
                group.users[groupToken.username].records[date].points += config.exTypes[exType].points * reps;
            }
        });
    } else {
        res.send({code: 5, error: "Invalid token"});
    }
});

app.post("/setweight/", (req, res) => {
    let token: string = req.body.token;
    let weight: number = req.body.weight;
    let date: string = req.body.date; //dd-mm-yyyy

    if(!date.match("[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}")) {
        res.send({code: 7, error: "Invalid date"});
    } else if(token in groupTokens) {
        let groupToken = groupTokens[token];
        getGroup(groupToken.group, (group) => {
            if(group == null) {
                res.send({code: 1, error: "Group does not exist"});
            } else {
                if(!(date in group.users[groupToken.username].records)) {
                    group.users[groupToken.username].records[date] = {reps: {}, points: 0, weight: -1};
                    for(let type in config.exTypes) {
                        group.users[groupToken.username].records[date].reps[type] = 0;
                    }
                }
                group.users[groupToken.username].records[date].weight = weight;
            }
        });
    } else {
        res.send({code: 5, error: "Invalid token"});
    }
});

app.post("/getextypes/", (req, res) => {
    let token: string = req.body.token;

    if(token in groupTokens) {
        let groupToken = groupTokens[token];
        getGroup(groupToken.group, (group) => {
            if(group == null) {
                res.send({code: 1, error: "Group does not exist"});
            } else {
                res.send({code: 0, exTypes: config.exTypes});
            }
        });
    } else {
        res.send({code: 5, error: "Invalid token"});
    }
});

process.on("SIGINT", () => {
    console.log("\nRecieved SIGINT, cleaning up...");
    saveCache(() => {
        console.log("Cache flushed, exiting");
        process.exit(0);
    });
});

app.listen(8989, () => {
    console.log("FATASS hosting on 8989");
	setInterval(() => {
		saveCache();
	}, config.saveInterval);
});
