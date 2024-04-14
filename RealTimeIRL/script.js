
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
				this.log("New Location:" + JSON.stringify(loc));
				var coord = L.latLng(loc.latitude, loc.longitude);
				this.gpsPin.setLatLng(coord);
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
				if (!this.mapVisible) return;
				// Zoom out to a regional area
				this.map.setZoom(this.config.mapZoomRegional, { duration: 2 }); // Adjust the zoom level for the regional area and duration
				setTimeout(() => {
					// Zoom back in to local roads
					this.map.setZoom(this.config.mapZoomLocal, { duration: 1 }); // Adjust the zoom level for local roads and duration
				}, 20 * 1000); // Keep it at 5 seconds for the regional view
			}, 50 * 1000);
		}

		if (this.logLoop) {
			clearInterval(this.logLoop);
			this.logLoop = null;
		}
		this.logLoop = setInterval(() => this.log(null), 1000);
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
        };
    }

    deserialize(data) {
		this.currentZoom = data?.zoom ?? this.config.mapZoom;
		this.mapVisible = data?.visible ?? true;
		this.toggleMap(this.mapVisible, false);
    }

    saveState() {
        SE_API.store.set(this.storeKey, this.serialize());
    }
    
    loadState(callback) {
        SE_API.store.get(this.storeKey).then(obj => {
            this.deserialize(obj);
			if (callback) callback();
        })
        .catch(err => {
            this.saveState();
			if (callback) callback(false);
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
		if (this.mapVisible) this.map.setZoom(this.currentZoom);
		this.log(`Map Zoomed ${relative ? (negative ? "out by" : "in by") : "to"} ${zoom}`);
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

}

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
