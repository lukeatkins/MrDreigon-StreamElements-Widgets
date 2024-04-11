const UPDATE_INTERVAL = 5 * 60 * 1000; //5 Minutes
const API = "https://api.openweathermap.org/data/2.5/weather";

let fieldData, channel;

var div = document.getElementById('weather');

const COMMANDS = {
  setlocation: (args) => {
    if (args.length == 0) return;
  	fieldData.location = args.join(" ");
    update();
  }
};

window.addEventListener('onWidgetLoad', function (obj) {
	//console.log(obj);
    fieldData = obj.detail.fieldData;
  	channel = obj.detail.channel.username;
	setLabel("lblTemp");
	setLabel("lblHumidity");
	setLabel("lblForecast");
	if (fieldData.lblPosition === "after") {
		swapNodes("lblTemp", "temperature");
		swapNodes("lblHumidity", "humidity");
		swapNodes("lblForecast", "forecast");
		//$("#lblTemp").after($("#temperature"));
		//$("#lblHumidity").after($("#humidity"));
		//$("#lblForecast").after($("#forecast"));
	}
	if (fieldData.showHumidity === "no") document.getElementById("sectionHumidity").style.display = "none";
	if (fieldData.showTemp === "no") document.getElementById("sectionTemp").style.display = "none";
	if (fieldData.showForecast === "no") document.getElementById("sectionForecast").style.display = "none";
  	update();
    setInterval(update, UPDATE_INTERVAL);
});

function swapNodes(aId, bId) {
	var a = document.getElementById(aId);
	var b = document.getElementById(bId);
    var aparent = a.parentNode;
    var asibling = a.nextSibling === b ? a : a.nextSibling;
    b.parentNode.insertBefore(a, b);
    aparent.insertBefore(b, asibling);
}

function setLabel(lbl) {
	if (fieldData[lbl].length == 0) {
		document.getElementById(lbl).style.display = "none";
	} else {
		document.getElementById(lbl).innerHTML = fieldData[lbl];
	}
}

window.addEventListener('onEventReceived', (evt) => {
  switch (evt.detail.listener) {
    case "message":
      handleMessage(evt.detail.event.data);
      break;
  }
});

function handleMessage(evt) {
  	var userState = { mod: parseInt(evt.tags.mod), broadcaster: evt.nick === channel };
	if (!(userState.mod == 1 || userState.broadcaster)) return;
  	var msg = evt.text;
  	if (!msg.startsWith("!")) return;
  	var args = msg.substring(1).split(" ");
   	var cmd = args.shift().toLowerCase();
  	
  	for (var key in COMMANDS) {
    	if (key === cmd) {
          COMMANDS[key](args);
        }
    }
  	
}

function update() {
  
	var url = new URL(API);
	url.searchParams.append("q", fieldData.location);
	url.searchParams.append("appid", fieldData.apikey);
	url.searchParams.append("units", "metric");
	if (fieldData.showLocation === "yes") {
		document.getElementById("location").innerHTML = fieldData.location;
	} else {
		document.getElementById("location").style.display = "none";
	}
	fetch(url)
		.then(response => response.json())
		.then(data => displayWeather(data));
}

function displayWeather(data) {
	if (data.cod == 401) {
		return console.log("Invalid API Key");
	}
	var celcius = data.main.temp;
	var tempDisplay = "";
	switch(fieldData.units) {
		case "C":
			tempDisplay = celcius.toFixed(fieldData.rounding) + "&deg;C";
			break;
		case "F":
			tempDisplay = C2F(celcius).toFixed(fieldData.rounding) + "&deg;F";
			break;
		case "CF":
			tempDisplay = celcius.toFixed(fieldData.rounding) + "&deg;C | " + C2F(celcius).toFixed(fieldData.rounding) + "&deg;F";
			break;
	}	
	document.getElementById("temperature").innerHTML = tempDisplay;
	document.getElementById("humidity").innerHTML = data.main.humidity + "%";
	document.getElementById("forecast").src = `http://openweathermap.org/img/w/${data.weather[0].icon}.png`;
}


function C2F(c) {
	return (c * 9/5) + 32;
}