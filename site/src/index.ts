export {};

type Exercise = {
    name: string,
    points: number
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

const groupFinder = document.querySelector("#groupFinder") as HTMLDivElement;
const fatassContainer = document.querySelector("#fatassContainer") as HTMLDivElement;
const groupCode = document.querySelector("#groupCode") as HTMLInputElement;
const groupPass = document.querySelector("#groupPass") as HTMLInputElement;
const usernameField = document.querySelector("#username") as HTMLInputElement;
const joinButton = document.querySelector("#join") as HTMLButtonElement;

const repsNum = document.querySelector("#numEx") as HTMLInputElement;
const exTypeSelect = document.querySelector("#extype") as HTMLSelectElement;
const exSubmit = document.querySelector("#subEx") as HTMLButtonElement;

const weightField = document.querySelector("#weight") as HTMLInputElement;
const weightSubmit = document.querySelector("#subWeight") as HTMLButtonElement;

let token: string;
let username: string;

let exTypes: {[name: string]: Exercise} = {};
let users: {[name: string]: User} = {};

function getMostRecentRecord(user: User): DayRecord {
    let mostRecent = "01-01-0000";
    for(let date in user.records) {
        let parts = date.split("-");
        let recentParts = mostRecent.split("-");
        if(+parts[2] > +recentParts[2]) {
            mostRecent = date;
        } else if(+parts[2] == +recentParts[2] && +parts[1] > +recentParts[1]) {
            mostRecent = date;
        } else if(+parts[1] == +recentParts[1] && +parts[2] == +recentParts[2] && +parts[0] > +recentParts[0]) {
            mostRecent = date;
        }
    }
    return user.records[mostRecent];
}

//token should already be set
function initMain() {
    let req = new XMLHttpRequest();
    req.open("POST", "/fatass/api/getextypes/", true);
    req.setRequestHeader("Content-Type", "application/json");
    req.onreadystatechange = () => {
        if(req.readyState == 4 && req.status == 200) {
            let resp = JSON.parse(req.response);
            if(resp.code == 0) {
                exTypes = resp.exTypes;
                for(let ex in exTypes) {
                    let opt = document.createElement("option");
                    opt.value = ex;
                    opt.textContent = exTypes[ex].name + ": " + exTypes[ex].points + "pt";
                    exTypeSelect.appendChild(opt);
                }
            } else {
                console.log("Exercise types could not be gotted");
            }
        }
    };
    req.send(JSON.stringify({token: token}));

    let req2 = new XMLHttpRequest();
    req2.open("POST", "/fatass/api/groupinfo/", true);
    req2.setRequestHeader("Content-Type", "application/json");
    req2.onreadystatechange = () => {
        if(req2.readyState == 4 && req2.status == 200) {
            let resp = JSON.parse(req2.response);
            if(resp.code == 0) {
                users = resp.users;
                let user = users[username];
                let record = getMostRecentRecord(user);
                weightField.value = "" + record.weight;
            } else {
                console.log("Group info could not be gotted");
            }
        }
    };
    req2.send(JSON.stringify({token: token}));
}

function setup() {
	const urlParams = new URLSearchParams(window.location.search);
	if(urlParams.has("group")) {
		groupCode.value = urlParams.get("group")!;
	} else {
        if(localStorage.getItem("fatassUsername")) {
            usernameField.value = localStorage.getItem("fatassUsername")!;
        }
        if(localStorage.getItem("fatassGroupCode")) {
            groupCode.value = localStorage.getItem("fatassGroupCode")!;
            let req = new XMLHttpRequest();
            req.open("POST", "/fatass/api/groupexists/", true);
            req.setRequestHeader("Content-Type", "application/json");
            req.onreadystatechange = () => {
                if(req.readyState == 4 && req.status == 200) {
                    let resp = JSON.parse(req.response);
                    joinButton.disabled = !resp.exists;
                }
            };
            req.send(JSON.stringify({groupCode: groupCode.value}));
        }
    }

    groupCode.oninput = () => {
        let req = new XMLHttpRequest();
        req.open("POST", "/fatass/api/groupexists/", true);
        req.setRequestHeader("Content-Type", "application/json");
        req.onreadystatechange = () => {
            if(req.readyState == 4 && req.status == 200) {
                let resp = JSON.parse(req.response);
                joinButton.disabled = !resp.exists;
            }
        };
        req.send(JSON.stringify({groupCode: groupCode.value}));
    };

    joinButton.onclick = () => {
        let group = groupCode.value;
        let pass = groupPass.value;
        username = usernameField.value;

        let req = new XMLHttpRequest();
        req.open("POST", "/fatass/api/login/", true);
        req.setRequestHeader("Content-Type", "application/json");
        req.onreadystatechange = () => {
            if(req.readyState == 4 && req.status == 200) {
                let resp = JSON.parse(req.response);
                if(resp.code == 0) {
                    token = resp.token;
                    initMain();
    
                    localStorage.setItem("fatassUsername", username);
                    localStorage.setItem("fatassGroupCode", group);
                } else {
                    console.log("login failed: " + resp.error);
                }
            }
        };
        req.send(JSON.stringify({username: username, groupCode: group, groupPass: pass}));

        groupFinder.style.display = "none";
        fatassContainer.style.display = "flex";
    };

    weightSubmit.onclick = () => {
        let date = new Date(); //already localized
        
        let dateString = (date.getDate().toString(10).padStart(2, "0")) + "-" + ((date.getMonth() + 1).toString(10).padStart(2, "0")) + "-" + date.getFullYear();
        let weight = +weightField.value;

        let req = new XMLHttpRequest();
        req.open("POST", "/fatass/api/setweight/", true);
        req.setRequestHeader("Content-Type", "application/json");
        req.onreadystatechange = () => {
            if(req.readyState == 4 && req.status == 200) {
                let resp = JSON.parse(req.response);
                if(resp.code == 0) {
                    //process new record TODO
                    console.log(resp.record);
                } else {
                    console.log("setweight failed: " + resp.error);
                }
            }
        };
        req.send(JSON.stringify({token: token, weight: weight, date: dateString}));
    };

    exSubmit.onclick = () => {
        let date = new Date(); //already localized
        
        let dateString = (date.getDate().toString(10).padStart(2, "0")) + "-" + ((date.getMonth() + 1).toString(10).padStart(2, "0")) + "-" + date.getFullYear();
        let reps = +repsNum.value;
        let exType = exTypeSelect.value;

        let req = new XMLHttpRequest();
        req.open("POST", "/fatass/api/addreps/", true);
        req.setRequestHeader("Content-Type", "application/json");
        req.onreadystatechange = () => {
            if(req.readyState == 4 && req.status == 200) {
                let resp = JSON.parse(req.response);
                if(resp.code == 0) {
                    //process new record TODO
                    console.log(resp.record);
                } else {
                    console.log("addreps failed: " + resp.error);
                }
            }
        };
        req.send(JSON.stringify({token: token, reps: reps, extype: exType, date: dateString}));
    };
}

setup();