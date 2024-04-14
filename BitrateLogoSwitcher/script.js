
class DreigonWidget {

    constructor(widgetName, storeKey) {
		this.widgetName = widgetName;
        this.config = null;
        this.channel = null;
        this.channelId = null;
        this.chatToken = null;
        this.storeKey = storeKey
        this.commands = {};

		this.logger = new DreigonLogger(widgetName);
		this.log = this.logger.log.bind(this.logger);

		this.init();
    }

    init() {
        window.addEventListener('onEventReceived', this.onEvent.bind(this));
        window.addEventListener('onWidgetLoad', (obj) => {
            this.channel = obj.detail.channel.username;
            this.channelId = obj.detail.channel.id;
            this.config = obj.detail.fieldData;
            this.chatToken = this.config.jebaitedToken;
			if (this.config.discordLogWebhook) {
				this.logger.enableDiscordLogging(this.config.discordLogWebhook, this.config.discordLogWebhookThreadId);
			}
            this.loadState(() => this.start());
        });
    }

    start() {
		this.log("Widget Started");		
    }

	startLoop(loopName, interval, func) {
		if (this[loopName]) {
			clearInterval(this[loopName]);
			this[loopName] = null;
		}
		this[loopName] = setInterval(func, interval);
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
            WidgetName: this.widgetName
        };
    }

    deserialize(data) {
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
        if (!this.chatToken) return;
        fetch(`https://api.jebaited.net/botMsg/${this.chatToken}/${encodeURIComponent(msg.toString())}`).then(res => {
            this.log("Chat Message Sent: " + msg);
        }).catch(err => {
            this.log("Error sending chat message: " + err);
        });
    }

}

class DreigonLogger {
	
	constructor(widgetName) {
		this.widgetName = widgetName;
		this.lastLogMessageTS = 0;
		this.logMessageRateLimit = 5000;
		this.logQueue = [];
		
		if (this.logLoop) {
			clearInterval(this.logLoop);
			this.logLoop = null;
		}
		this.logLoop = setInterval(() => this.log(), 1000);
	}

	enableDiscordLogging(webhook, thread) {
		this.webhook = webhook;
		this.threadId = thread;
	}

	argsToString(args) {
		return args.map(arg => {
			if (typeof arg === 'function') {
				return arg.toString(); // if it's a function, return its source code
			} else {
				return JSON.stringify(arg); // otherwise stringify normally
			}
		}).join(', '); // join arguments with commas
	}

	log() {
		var args = Array.from(arguments);
		if (args.length > 0) console.log(...args);
		if (this.webhook) {
			var elapsed = Date.now() - this.lastLogMessageTS;
			if (args.length > 0) this.logQueue.push(`[${WidgetName}][${this.getTimestamp()}] ${this.argsToString(args)}`);
			if (elapsed < this.logMessageRateLimit) return;
			if (this.logQueue.length == 0) return;
			var message = this.logQueue.join("\n");
			this.logQueue = [];
			this.lastLogMessageTS = Date.now();
			var url = this.webhook;
			if (this.threadId) url += "?thread_id=" + this.threadId;
			fetch(url, {
				method: "POST",
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({content: message}),
			}).then(res => {

			}).catch(err => {

			});
		}
	}

	getTimestamp() {
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
 
class BitrateLogoDisplay extends DreigonWidget {

	constructor() {
		super("Bitrate Logo", "dreigon-bitrate-logo");
		this.options = {
			updateRate: 1 * 1000,
			fetchTimeout: 10000,
		}
		this.lastBitrateCheck = 0;
		this.bitrateElem = document.getElementById("bitrateDisplay");
}

	start() {
		super.start();
		this.images = this.config.bitrateLogos.map(url => {
			var img = document.createElement("img");
			img.src = url;
			img.className = "Bitrate-Logo";
			img.style.display = "none";
			this.bitrateElem.appendChild(img);
			return img;
		});
		this.cutoffs = this.config.bitrateCutoffs.split(",").map(str => {
			try {
				var num = parseFloat(str.trim());
				return num;
			} catch (err) {
				return "Error";
			}
		}).filter(e => e !== "Error");
		this.startLoop("bitrateLoop", this.options.updateRate, this.getBitrate.bind(this));
		this.displayBitrate("Offline", 0);
	}

	getBitrate() {
		var elapsed = (Date.now() - this.lastBitrateCheck);
		var timeout = elapsed > this.options.fetchTimeout;
		var urls = [this.config.statsURL, this.config.statsURLSecondary];
		var count = 2;
		if (this.fetchingBitrate && !timeout) return;
		this.fetchingBitrate = true;
		this.lastBitrateCheck = Date.now();

		var result = [];
		urls.forEach(url => {
			if (url === null || url === undefined || url === "") {
				count--;
				if (count == 0) this.fetchingBitrate = false;
				return;
			}
			fetch(url)
			.then(res => {
				return res.text()
			})
			.then(body => {
				result.push({Url: url, Success: true, Body: body});
				count--;
				if (count == 0) this.handleBitrateResult(result);
			})
			.catch(err => {
				result.push({Url: url, Success: false, Error: err});
				count--;
				if (count == 0) this.handleBitrateResult(result);
			});			
		})
	}

	handleBitrateResult(result) {
		var bitrateResult = {Type: "Offline", Bitrate: 0};
		result.forEach(res => {
			var type = res.Url == this.config.statsURL ? "Primary" : "Secondary";
			if (!res.Success) return;
			var bitrate = this.parseBitrate(res.Body);
			if (bitrate > bitrateResult.Bitrate) bitrateResult = {Type: type, Bitrate: this.parseBitrate(res.Body)};
		});
		this.displayBitrate(bitrateResult.Type, bitrateResult.Bitrate);
	}

	displayBitrate(type, bitrate) {
		var index = 0;
		if (type != "Offline") {
			for (var i = 0; i < this.cutoffs.length; i++) {
				var cutoff = this.cutoffs[i];
				if (bitrate >= cutoff) {
					index = i;
				} else {
					break;
				}
			}
		}
		//Toggle Selected Image
		this.images.forEach((img,i) => {
			img.style.display = index == i ? "block" : "none";			
		});
	}

	parseBitrate(text) {
		if (text.startsWith("<?xml")) {
			return this.parseBitrateXML(text);
		}
		return this.parseBitrateJson(text);
	}

	parseBitrateXML(text) {
		return 0;
	}

	parseBitrateJson(text) {
		try {
			var data = JSON.parse(text);
			if (data.publishers !== undefined) { //SRT
				var streamKeys = Array.from(Object.keys(data.publishers));
				if (streamKeys.length == 0) return 0;
				return _.maxArray(streamKeys.map(key => data.publishers[key].bitrate));
			}
			if (data.nginx_rtmp_version !== undefined) { //NGINX XML JSON
				var apps = data.server.application;
				//this.log(apps);
				if (!(apps instanceof Array)) apps = [apps];
				return _.maxArray(apps.map(app => {
					if (app.live?.stream == undefined) return 0;
					return app.live.stream.bw_in / 1024;
				}));
			}
		} catch(err) {
			//this.log(err);
			return 0;
		}
	}

}

const app = new BitrateLogoDisplay();