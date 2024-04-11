
window.addEventListener('onWidgetLoad', function (obj) {
	var app = new BitrateDisplay(obj.detail.fieldData);
 });
 
 class BitrateDisplay {
   
   constructor(config) {
	 this.config = {
	   StatsURL: config.statsURL,
	   StatsURL2: config.statsURL2,
	 };
	 this.options = {
	   updateRate: 1 * 1000,
	   maxHistory: 6000,
	   movingAvgSize: 10,
	   fetchTimeout: 10000,
	 }
	 this.fetchStart = 0;
	 this.updateRate = 1 * 1000;
	 this.elem = document.getElementById("bitrateDisplay");
	 this.start();
   }
	 
   start() {
	 setInterval(this.getBitrate.bind(this), this.options.updateRate);		
   }
   
   getBitrate() {
	 var elapsed = (Date.now() - this.fetchStart);
	 var timeout = elapsed > this.options.fetchTimeout;
	 if (!this.config?.StatsURL || (this.fetchingBitrate && !timeout)) return;
	 this.fetchingBitrate = true;
	 this.fetchStart = Date.now();
	 fetch(this.config.StatsURL, res => {
	   this.fetchingBitrate = false;
	   if (!res.Success) return console.log(res);
	   var data;
	   if (res.Body.startsWith("<?xml")) {
		 //data = this.parseXML(res.Body);
		 return;
	   } else {
		 data = JSON.parse(res.Body);
	   }
	   this.updateBitrate(data);
	   });
	 }
	 
	 updateBitrate(data) {
		 var bitrate = {};
		 if (data.publishers !== undefined) { //SRT
			 var key = Object.keys(data.publishers[0]);
				if (!key) return;
			 data = data.publishers[key];
			 bitrate = {
				 online: data.connected,
				 br: data.bitrate,
			 }
		 } else {
			 bitrate = {
				 online: data.isLive,
				 br: data.bitrate,
			 }
		 }
		 this.elem.innerHTML = bitrate.br.toString();
	 }
   
 }