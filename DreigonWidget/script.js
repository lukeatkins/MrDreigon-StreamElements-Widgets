
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
			this.storage = new StorageHandler(this.channel, this.storeKey, this.config.storageType, {Host: this.config.dreigonStorageURL});
            this.loadState(() => this.start());
        });
    }

    start() {
		this.log("Widget Started");		
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
		this.storage.saveState(this.serialize());
        //SE_API.store.set(this.storeKey, this.serialize());
    }
    
    loadState(callback) {
		this.storage.loadState(state => {
			if (state === "false") return console.log("State not initialized");
			this.deserialize(state);
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

const StorageHandlerTypeEnum = {
	StreamElements: "SE",
	DreigonWeb: "Dreigon"
}

class StorageHandler {

	constructor(channel, storeKey, type, options) {
		this.storeKey = `${channel}-${storeKey}`;
		this.type = type;
		this.options = options;
	}

	saveState(state, callback) {
		switch (this.type) {
			case StorageHandlerTypeEnum.StreamElements:
				return this.saveStateSE(state);

			case StorageHandlerTypeEnum.DreigonWeb:
				return this.saveStateDreigon(state);				
		}
	}

	loadState(callback) {
		switch (this.type) {
			case StorageHandlerTypeEnum.StreamElements:
				return this.loadStateSE(callback);

			case StorageHandlerTypeEnum.DreigonWeb:
				return this.loadStateDreigon(callback);				
		}
    }

	saveStateSE(state) {
        SE_API.store.set(this.storeKey, state);
    }
    
    loadStateSE(callback) {
        SE_API.store.get(this.storeKey).then(obj => {
			if (callback) callback(obj);
        })
        .catch(err => {
			if (callback) callback(false);
        });
    }

	saveStateDreigon(state) {
		this.storeValueDreigon(this.storeKey, state, res => {
			if (!res.Success) console.log("Failed to Save State", res);
		});
    }
    
    loadStateDreigon(callback) {
		this.fetchValueDreigon(this.storeKey, res => {
			if (!res.Success) return console.log("Failed to load state!", res);
			if (callback) callback(res.Value);

		});
    }

	storeValueDreigon(key, value, callback) {
		var req = {
			Action: "Store",
			Data: {
				Query: "set",
				Key: key,
				Value: value,
			}
		}
		fetch(`https://${this.options.Host}/api`, {
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

	fetchValueDreigon(key, callback) {
		var req = {
			Action: "Store",
			Data: {
				Query: "get",
				Key: key,
			}
		}
		fetch(`https://${this.options.Host}/api`, {
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

const app = new DreigonWidget();