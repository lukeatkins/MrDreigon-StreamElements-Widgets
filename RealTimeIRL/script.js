
const WidgetName = "RealTime IRL Map";

class DreigonWidget {

    constructor() {
        this.config = null;
        this.channel = null;
        this.channelId = null;
        this.token = null;
        this.storeKey = "dreigon-rtirl"
        this.commands = {
			mapon: () => this.toggleMap(true),
			mapoff: () => this.toggleMap(false),
			zoomin: (z) => this.setZoom(z ?? 1,true),
			zoomout: (z) => this.setZoom(z ?? 1,true, true),
			zoom: (z) => this.setZoom(z,false),
			getdist: (id) => this.getDistance(id),
			setdist: (id, val) => this.setDistance(id, val),
			getdistall: () => this.getAllDistances(),
			lockdist: (id) => this.lockDistanceTracker(id),
			unlockdist: (id) => this.unlockDistanceTracker(id),
        };

		this.zoomLevel = {
			Regional: 8,
			Local: 16
		}

		this.logQueue = [];
		this.lastLogMessageTS = 0;
		this.logMessageRateLimit = 10000;

		this.currentZoom;
		this.mapVisible = true;
		this.distances = {
			total: 0
		};

        this.init();
    }

    init() {
        window.addEventListener('onEventReceived', this.onEvent.bind(this));
        window.addEventListener('onWidgetLoad', (obj) => {
            this.channel = obj.detail.channel.username;
            this.channelId = obj.detail.channel.id;
            this.config = obj.detail.fieldData;
            this.token = this.config.jebaitedToken;
            this.loadState(() => this.start());
        });
    }

    start() {
		this.log("Widget Started");
        var container = document.getElementById("map");
        this.map = L.map(container, {
            attributionControl: false,
            zoomControl: false,
            dragging: false,
        }).setView([0, 0], this.config.mapZoom);
		var tileUrl = this.config.mapTileLayer;
		if (tileUrl == "custom") {
			tileUrl = this.config.mapTileLayerCustom;
		}
		this.tileLayer = L.tileLayer(tileUrl, {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                zoom: this.config.currentZoom,
            }
        );
        this.tileLayer.addTo(this.map);
		this.tileLayer.on("tileerror", err => {
			this.log("Tile Error: " + JSON.stringify(err));
		});
		var icon = `https://earth.google.com/earth/rpc/cc/icon?color=943bf9&id=2000&scale=4`;//fallback
		if (this.config.googleEarthIcon == "custom") {
			if (this.config.iconURL) icon = this.config.iconURL;
		} else {
			var id = this.config.googleEarthIcon;
			if (id == "other") id = this.config.googleEarthIconOther;
			this.log("Pin Color: " + this.config.googleEarthIconColor);
			icon = `https://earth.google.com/earth/rpc/cc/icon?color=${this.config.googleEarthIconColor.substring(1)}&id=${id}&scale=2`;
		}
		var scale = this.config.iconScale ?? 1;
		this.gpsPin = L.marker([0,0], {
			icon: L.icon({
				iconUrl: icon,
				iconSize: [64*scale,64*scale],
				iconAnchor: [32*scale,64*scale]
			})
		});
		this.gpsPin.addTo(this.map);

        const pullKey = this.config.rtIRLAPIKey;
        if (pullKey) {
			this.rtirlAPI = new RTIRLAPI(this, pullKey);
			this.rtirlAPI.start();
			this.rtirlAPI.on("location", loc => {
				if (this.config.doLogLocation) this.log("New Location:" + JSON.stringify(loc));
				var coord = L.latLng(loc.latitude, loc.longitude);
				this.gpsPin.setLatLng(coord);
				if (this.lastCoord) {
					var distance = this.lastCoord.distanceTo(coord) / 1000;
					for (var i in this.distances) {
						if (typeof(this.distances[i]) == "object" && this.distances[i].lock) continue;
						this.distances[i] += distance;
					}
					this.saveState();
				}
				this.lastCoord = coord;
				if (this.mapVisible) this.map.panTo(coord, {duration: 1.5});
			});
        }
		
        // Automatically zoom out and in at a set time interval
		if (this.config.doZoomLoop) {
			if (this.zoomLoop) {
				clearInterval(this.zoomLoop);
				this.zoomLoop = null;
			}
			this.zoomLoop = setInterval(() => {
				if (!this.mapVisible || !this.lastCoord) return;
				// Zoom out to a regional area
				this.map.flyTo(this.lastCoord, this.config.mapZoomRegional, { animate: true, duration: 1 }); // Adjust the zoom level for the regional area and duration
				setTimeout(() => {
					// Zoom back in to local roads
					this.map.flyTo(this.lastCoord, this.config.mapZoomLocal, { animate: true, duration: 1 }); // Adjust the zoom level for local roads and duration
				}, 20 * 1000); // Keep it at 5 seconds for the regional view
			}, 50 * 1000);
		}

		if (this.logLoop) {
			clearInterval(this.logLoop);
			this.logLoop = null;
		}
		this.logLoop = setInterval(() => this.log(null), 1000);
		
		this.toggleMap(this.mapVisible, false);
    }

    onEvent(evt) {
        const listener = evt.detail.listener;
        if (evt.detail.event) {
            if (evt.detail.event.listener === 'widget-button') {
                var id = evt.detail.event.field;
                this.onWidgetButton(id);                
                return;
            }
        }
    
        if (listener.endsWith("-latest")) {
            const data = evt.detail.event;
            switch (listener) {
                case "follower-latest":
                    this.onFollower(data);
                    return;
                case "subscriber-latest":
                    if (data.bulkGifted) return; // Ignore gifting event and count only real subs
                    var tier = parseInt(data.tier);
                    switch (tier) {
                        default:
                            this.onTier1Sub(data);
                            return;
                        case 2000:
                            this.onTier2Sub(data);
                            return;
                        case 3000:
                            this.onTier3Sub(data);
                            return;
                    }
                    return;
                case "host-latest":
                    this.onHostEvent(data);
                    return;
                case "raid-latest":
                    this.onRaidEvent(data);
                    return;
                case "cheer-latest":
                    this.onCheerEvent(data);
                    return;
                case "tip-latest":
                    this.onTipEvent(data);
                    return;
            }
        }

        switch(listener) {
            case "message":
                this.handleMessage(evt.detail.event.data);
                break;
        }
    }

    onWidgetButton(id) {
		switch (id) {
			case "btnResetMapZoom":
				if (this.config.mapZoom) this.setZoom(this.config.mapZoom, false);
				break;
		}
    }
    
    onFollower(data) {
    }

    onTier1Sub(data) {        
    }

    onTier2Sub(data) {        
    }

    onTier3Sub(data) {        
    }

    onHostEvent(data) {
    }

    onRaidEvent(data) {
    }

    onCheerEvent(data) {
    }

    onTipEvent(data) {
    }

    serialize() {
        return {
            zoom: this.currentZoom,
			visible: this.mapVisible,
			distances: this.distances
        };
    }

    deserialize(data) {
		this.currentZoom = data?.zoom ?? this.config.mapZoom;
		this.mapVisible = data?.visible ?? true;
		if (data.distances != undefined) {
			this.distances = data.distances
		}
    }

    saveState() {
		this.storeValue(this.storeKey, this.serialize(), res => {
			if (!res.Success) this.log("Failed to Save State", res);
		});
    }
    
    loadState(callback, firstTry = true) {
		this.fetchValue(this.storeKey, res => {
			if (!res.Success) return this.log("Failed to load state!", res);
			this.deserialize(res.Value);
			if (callback) callback();

		});
    }

    handleMessage(evt) {
        var userState = { mod: parseInt(evt.tags.mod), broadcaster: evt.nick === this.channel };
        if (!(userState.mod == 1 || userState.broadcaster)) return;
        var msg = evt.text;
        if (!msg.startsWith("!")) return;
        var args = msg.substring(1).split(" ");
        var cmd = args.shift().toLowerCase();

        for (var key in this.commands) {
            if (key.toLocaleLowerCase() === cmd.toLocaleLowerCase()) {
                this.commands[key](...args);
            }
        }
    }

    sendMessage(msg) {
        if (!this.token) return;
        fetch(`https://api.jebaited.net/botMsg/${this.token}/${encodeURIComponent(msg.toString())}`).then(res => {
            this.log("Chat Message Sent: " + msg);
        }).catch(err => {
            this.log("Error sending chat message: " + err);
        });
    }

	toggleMap(visible, chatMsg = true) {
		if (visible) {
			$("#map").show();
			this.map.invalidateSize();
			this.map.setZoom(this.currentZoom);
			if (this.lastCoord) this.map.panTo(this.lastCoord);
			if (chatMsg) this.sendMessage("Map Opened");
			this.log("Map Opened");
		} else {
			$("#map").hide();
			if (chatMsg) this.sendMessage("Map Closed");
			this.log("Map Closed");
		}
		this.mapVisible = visible;
		this.saveState();
	}

	setZoom(zoom = 1, relative = true, negative = false) {
		if (isNaN(zoom)) return;
		if (typeof(zoom) == "string") {
			try { 
				zoom = parseInt(zoom)
			} catch(err) {}
		}
		if (relative && negative) zoom = -zoom;
		var oldZoom = this.currentZoom;
		if (relative) this.currentZoom += zoom;
		else this.currentZoom = zoom;
		if (this.currentZoom < 0) this.currentZoom = oldZoom;
		this.saveState();
		if (this.mapVisible) {
			if (this.lastCoord) this.map.flyTo(this.lastCoord, this.currentZoom, {animate: true, duration: 1});
			else this.map.setZoom(this.currentZoom, {animate: true, duration: 1});
		}
		this.log(`Map Zoomed ${relative ? (negative ? "out by" : "in by") : "to"} ${zoom}`);
	}

	getDistance(id) {
		var key = this.distances[id] !== undefined ? id : "total";
		var val = this.distances[key];
		if (typeof(val) == "object") val = val.value;
		this.sendMessage(`${key == "total" ? "Total" : "Distance " + key} is ${_.Formatters.float(val, {decimals: 1, units: " km"})}`);
	}

	getAllDistances() {
		var message = `Total Distance ${_.Formatters.float(this.distances.total, {decimals: 1, units: " km"})}.`;
		for (var i in this.distances) {
			if (i == "total") continue;
			var val = this.distances[i];
			if (typeof(val) == "object") val = val.value;
			message += ` ${i}: ${_.Formatters.float(val, {decimals: 1, units: " km"})}.`;
		}
		this.sendMessage(message);
	}

	lockDistanceTracker(id) {
		if (this.distances[id] == undefined) return this.sendMessage(`Unknown Distance Tracker ${id}`);
		if (id == "total") return this.sendMessage(`Can't lock total distance tracker`)
		var val = this.distances[id];
		if (typeof(val) == "object") val = val.value;
		this.distances[id] = {
			lock: true,
			value: val,
		};
		this.saveState();
		this.sendMessage(`Distance Tracker ${id} locked at ${_.Formatters.float(val, {decimals: 1, units: " km"})}`);
	}

	unlockDistanceTracker(id) {
		if (this.distances[id] == undefined) return this.sendMessage(`Unknown Distance Tracker ${id}`);
		// if (id == "total") return this.sendMessage(`Can't lock total distance tracker`)
		
		if (typeof(this.distances[id]) == "object") this.distances[id] = this.distances[id].value;
		this.saveState();
		this.sendMessage(`Distance Tracker ${id} unlocked`);
	}

	setDistance(id, value) {
		if (!isNaN(id)) { //If Id is a number, (eg !setdist 10), use the total tracker and use id field as value
			value = parseFloat(id);
			id = "total";
		} else {
			if (value == undefined) return this.sendMessage("Value missing. Usage: !setdist <id> <value>");
			if (isNaN(value)) return this.sendMessage("Invalid value. Usage: !setdist <id> <value>");
			value = parseFloat(value);
		}
		if (typeof(this.distances[id]) == "object" && this.distances[id].lock == true) return this.sendMessage(`Distance Tracker ${id} is locked`);
		this.distances[id] = value;
		this.saveState();
		this.sendMessage(`${id == "total" ? "Total" : "Distance " + id} set to ${_.Formatters.float(value, {decimals: 1, units: " km"})}`);
	}

	log(msg) {
		if (msg !== null) console.log(msg);
		if (this.config && this.config.discordLogWebhook) {
			var elapsed = Date.now() - this.lastLogMessageTS;
			if (msg !== null) this.logQueue.push(`[${WidgetName}][${getTimestamp()}] ${msg}`);
			if (elapsed < this.logMessageRateLimit) return;
			if (this.logQueue.length == 0) return;
			var message = this.logQueue.join("\n");
			this.logQueue = [];
			this.lastLogMessageTS = Date.now();
			var url = this.config.discordLogWebhook;
			if (this.config.discordLogWebhookThreadId) url += "?thread_id=" + this.config.discordLogWebhookThreadId;
			fetch(url, {
				method: "POST",
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({content: message}),
			}).then(res => {

			}).catch(err => {

			});
		}
	}
	
	storeValue(key, value, callback) {
		var req = {
			Action: "Store",
			Data: {
				Query: "set",
				Key: `${this.channel}-${key}`,
				Value: value,
			}
		}
		fetch(`https://beeboirl.hosthampster.com/api`, {
			body: JSON.stringify(req),
			method: "POST"
		})
		.then(res => res.json())
		.then(res => {
			return callback(res);
		})
		.catch(err => {
			return callback({Success: false, Error: err});
		});
	}

	fetchValue(key, callback) {
		var req = {
			Action: "Store",
			Data: {
				Query: "get",
				Key: `${this.channel}-${key}`,
			}
		}
		fetch(`https://beeboirl.hosthampster.com/api`, {
			body: JSON.stringify(req),
			method: "POST"
		})
		.then(res => res.json())
		.then(res => {
			return callback(res);
		})
		.catch(err => {
			return callback({Success: false, Error: err});
		});
	}

}

const _ = {
	maxArray: (data) => {
		var max = null;
		data.forEach(v => {
			if (v === null || v === undefined || isNaN(v)) return;
			if (max === null || v > max) max = v;
		});
		return max;
	},
	
	minArray: (data) => {
		var min = null;
		data.forEach(v => {
			if (v === null || v === undefined || isNaN(v)) return;
			if (min === null ||v < min) min = v;
		});
		return min;
	},

	Formatters: {
		float: (val, params) => {
			if (params == null) params = {};
			if (val == null || isNaN(Number(val))) return val;
			if (params.showZeros !== undefined) {
				if (!params.showZeros && val === 0) return "-   ";
			}
			try {
				let decimals = 2;
				if (params.decimals !== undefined) decimals = params.decimals;
				let text = Number(val).toLocaleString("en-AU", {
					notation: "standard",
					minimumFractionDigits: decimals,
					maximumFractionDigits: decimals,
				});
				if (params.sign && val > 0) text = "+" + text;
				if (params.units) text += `${params.unitSpace ? " " : ""}${params.units}`;
				return text;
			} catch (err) {
				return `Error [${val}]`
			}
		}
	},
};

function getTimestamp() {
	const date = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    
    return formatter.format(date);
}

const RTIRLConf = {
	Namespace: "rtirl-a1d7f-default-rtdb",
	App_Id: "1:684852107701:web:d77a8ed0ee5095279a61fc",
	Version: 5,
}

class RTIRLAPI {

	constructor(widget, pullKey) {
		this.pullKey = pullKey;
		this.requestIndex = 1;
		this.requests = [];
		this.callbacks = {};
		this.widget = widget;
		this.events = {
			location: [],
		};
		this.connected = false;
	}

	start() {
		this.ws = new WebSocket(`wss://s-usc1a-nss-2007.firebaseio.com/.ws?v=${RTIRLConf.Version}&p=${RTIRLConf.App_Id}&ns=${RTIRLConf.Namespace}`);
		this.ws.addEventListener("open", evt => {
			this.connected = true;
			this.sendMessage({ a: "s",	b: { c: { "sdk.js.9-8-1": 1 } } }, res => {
				//this.widget.log("SDK Version set");
				this.registerCallback(`pullables/${this.pullKey}/location`, this.onLocationEvent.bind(this), res => {
					if (this.pingLoop) {
						clearInterval(this.pingLoop);
						this.pingLoop = null;
					}
					this.pingLoop = setInterval(() => {
						if (this.connected) this.ws.send("0");						
					}, 30000);
				});
			});
		});
		this.ws.addEventListener("message", this.onMessage.bind(this));
		this.ws.addEventListener("close", () => {
			this.connected = false;
			this.widget.log("RTIRL Error: Web Socket Closed Unexpectedly");
			this.start();
		});
	}

	on(evtName, callback) {
		if (this.events[evtName] instanceof Array && typeof(callback) == "function") this.events[evtName].push(callback);
	}

	emit(evtName, data) {
		if (!(this.events[evtName] instanceof Array)) return;
		this.events[evtName].forEach(cb => cb(data));
	}

	onMessage(evt) {
		try {
			var res = JSON.parse(evt.data);
			var id = res.d?.r;
			var req = this.requests.findIndex(e => e.Id == id);
			if (req != -1) {
				//this.widget.log(`Response to message [${id}]: `, JSON.stringify(res.d));
				req = this.requests.splice(req, 1)[0];
				if (req.Callback) req.Callback(res.d);
			} else {
				var listener = res.d?.b?.p;
				if (listener && this.callbacks[listener]) {
					this.callbacks[listener](res.d.b);
				} else {
					//this.widget.log("Generic Response: ", JSON.stringify(res.d));
				}
			}
		} catch(err) {
			this.widget.log("RTIRL Message Error: " + err);
		}
	}

	onLocationEvent(res) {
		var location = res.d;
		this.emit("location", location);
	}

	sendMessage(data, callback) {
		var index = this.requestIndex++;
		//this.widget.log(`Sending message [${index}]: `, JSON.stringify(data));
		var msg = {
			t: "d",
			d: {
				r: index,
				...data
			}
		};
		this.requests.push({Id: index, Callback: callback, Timestamp: Date.now()});
		if (this.connected) this.ws.send(JSON.stringify(msg));
	}

	registerCallback(listener, handler, callback) {
		this.callbacks[listener] = handler;
		this.sendMessage({ a: "q", b: { p: `/${listener}`, h: ""}}, res => {
			this.widget.log(`RTIRL Callback ${listener} registered`);
			callback(res);
		})
	}

}

const app = new DreigonWidget();
