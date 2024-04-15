
class DreigonMarathonWidget {

    constructor() {
        this.config = null;
        this.channel = null;
        this.channelId = null;
        this.token = null;
        this.currentValue = null;
        this.minValue = 0;
        this.maxValue = Number.MAX_SAFE_INTEGER;
        this.stopOnZero = false;
        this.addOnZero = false;
        this.updateLoop = null;
        this.storeKey = "dreigon-marathon";
        this.commands = {
            setmarathon: this.commandSetMarathon.bind(this),
            addmarathon: this.commandAddMarathon.bind(this),
            minusmarathon: this.commandMinusMarathon.bind(this),
        };

        this.init();
    }

    init() {
        window.addEventListener('onEventReceived', this.onEvent.bind(this));
        window.addEventListener('onWidgetLoad', (obj) => {
            console.log(JSON.stringify(obj.detail.channel));
            this.channel = obj.detail.channel.username;
            this.channelId = obj.detail.channel.id;
            this.config = obj.detail.fieldData;
            this.token = this.config.jebaitedToken;
            this.addOnZero = (this.config.addOnZero === "add");
            this.stopOnZero = (this.config.addOnZero === "stop");
            this.loadState();
            this.start();
        });

    }

    start() {
        if (this.updateLoop) clearInterval(this.updateLoop);
        setInterval(this.updateDisplay.bind(this), 1000);
        this.updateDisplay();
    }

    addValue(add) {
        if (this.stopOnZero) {
            if (this.currentValue > 0) {
                this.currentValue += add;
            }
        } else {
            this.currentValue += add;
        }
        if (this.currentValue > this.maxValue) this.currentValue = this.maxValue;
        this.saveState();
    }

    updateDisplay() {
        var text = this.getFormattedValue();
        if (this.currentValue === 0) text = this.config.onComplete;
        $("#countdown").html(text);
    }

    getFormattedValue(value = this.currentValue) {
        var text = formatFloat(value, {decimals: this.config.formatDecimals, units: this.config.formatUnits});
        return text;
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
        if (id === 'resetTimer') {
            this.minValue = this.config.minValue;
            this.maxValue = this.config.maxValue
            this.currentValue = this.minValue;
            this.addValue(0);
        } else if (id.startsWith("addValue")) {
            var num = Number(id.split("_")[1])
            if (!isNaN(num)) this.addValue(num);
        } else if (id === "addCustom") {
            var add = Number(this.config.addCustomValue);
            if (!isNaN(add)) this.addValue(add);
        } else if (id === "minusCustom") {
            var add = Number(this.config.minusCustomValue);
            if (!isNaN(add)) this.addValue(-add);
        }
    }
    
    onFollower(data) {
        if (this.config.followSeconds !== 0) this.addValue(this.config.followWeight);
    }

    onTier1Sub(data) {        
        if (this.config.sub1Weight !== 0) this.addValue(this.config.sub1Weight);
    }

    onTier2Sub(data) {        
        if (this.config.sub2Weight !== 0) this.addValue(this.config.sub2Weight);
    }

    onTier3Sub(data) {        
        if (this.config.sub3Weight !== 0) this.addValue(this.config.sub3Weight);
    }

    onHostEvent(data) {
        if (data.amount < this.config.hostMin || this.config.hostWeight === 0) return;
        this.addValue(this.config.hostWeight * data.amount);
    }

    onRaidEvent(data) {
        if (data.amount < this.config.raidMin || this.config.raidWeight === 0) return;
        this.addValue(this.config.raidWeight * data.amount);
    }

    onCheerEvent(data) {
        if (data.amount < this.config.cheerMin || this.config.cheerWeight === 0) return;
        this.addValue(parseFloat(this.config.cheerWeight * data.amount / 100));
    }

    onTipEvent(data) {
        if (data.amount < this.config.tipMin || this.config.tipWeight === 0) return;
        this.addValue(parseFloat(this.config.tipWeight * data.amount));
    }

    saveState() {
		this.storeValue(this.storeKey, {current: this.currentValue, maxValue: this.maxValue, minValue: this.minValue}, res => {
			if (!res.Success) console.log("Failed to Save State", res);
		})
        //SE_API.store.set(this.storeKey, {current: this.currentValue, maxValue: this.maxValue, minValue: this.minValue});
    }
    
    loadState() {
		this.fetchValue(this.storeKey, res => {
			if (!res.Success) return this.log("Failed to load state!", res);
			var obj = res.Value;
        // SE_API.store.get(this.storeKey).then(obj => {
            console.log("Load State", this.config.preserveTime)
            if (obj !== null) {
                if (this.config.preserveTime === "save") {
                    this.currentValue = Number(obj.current);
                    this.minValue = Number(obj.minValue);
                    this.maxValue = Number(obj.maxValue);
                } else if (this.config.preserveTime === "restart") {
                    this.minValue = this.config.minValue;
                    this.maxValue = this.config.maxValue;
                    this.currentValue = this.minValue;
                }
                if (this.currentValue > 0) {
                    //this.currentValue = Math.max(this.currentValue, this.minValue);
                    this.addValue(0);
                } else {
                    this.currentValue = this.minValue;
                    this.addValue(0);
                }
            } else {
                this.currentValue = this.minValue;
                this.addValue(0);
            }
        });
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

    commandSetMarathon(value) {
        console.log("Set Marathon", value);
        if (value === undefined) return;
        value = parseFloat(value);
        if (isNaN(value)) return;
        this.currentValue = value;
        this.sendMessage(`Marathon set to ${this.getFormattedValue()}`);
        this.addValue(0);
    }

    commandAddMarathon(value) {
        console.log("Add Marathon", value);
        if (value === undefined) return;
        value = parseFloat(value);
        if (isNaN(value)) return;
        this.currentValue += value;
        this.sendMessage(`Added ${this.getFormattedValue(value)} to Marathon`);
        this.addValue(0);
    }

    commandMinusMarathon(value) {
        console.log("Minus Marathon", value);
        if (value === undefined) return;
        value = parseFloat(value);
        if (isNaN(value)) return;
        this.currentValue -= value;
        this.sendMessage(`Subtracted ${this.getFormattedValue(value)} from Marathon`);
        this.addValue(0);
    }

    sendMessage(msg) {
        if (!this.token) return;
        fetch(`https://api.jebaited.net/botMsg/${this.token}/${encodeURIComponent(msg.toString())}`).then(res => {
            console.log("Message Sent: ", res);
        }).catch(err => {
            console.log("Error sending message: ", err);
        });
    }

}

function formatFloat(val, params) {
	if (params == null) params = {};
	if (val == null || isNaN(Number(val))) return val;
	if (params.showZeros !== undefined) {
		if (!params.showZeros && val === 0) return "-   ";
	}
	try {
		let decimals = 2;
		if (params.decimals) decimals = params.decimals;
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

const app = new DreigonMarathonWidget();
