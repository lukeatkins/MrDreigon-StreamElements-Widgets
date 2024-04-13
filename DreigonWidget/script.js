
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
		this.log = this.logger.log,bind(this.logger);

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

