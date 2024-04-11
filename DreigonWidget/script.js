
class DreigonWidget {

    constructor() {
        this.config = null;
        this.channel = null;
        this.channelId = null;
        this.token = null;
        this.storeKey = "Dreigon-Widget-Data"
        this.commands = {
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
            this.loadState();
            this.start();
        });

    }

    start() {
       
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
            
        };
    }

    deserialize(data) {

    }

    saveState() {
        SE_API.store.set(this.storeKey, this.serialize());
    }
    
    loadState() {
        SE_API.store.get(this.storeKey).then(obj => {
            this.deserialize();
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
            console.log("Message Sent: ", res);
        }).catch(err => {
            console.log("Error sending message: ", err);
        });
    }

}

const app = new DreigonWidget();
