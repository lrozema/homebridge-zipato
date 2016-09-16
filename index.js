var zipabox = require("zipabox");
var Accessory, Service, Characteristic, platform;

module.exports = function(homebridge) {
	console.log("homebridge API version: " + homebridge.version);

	// Accessory must be created from PlatformAccessory Constructor
	Accessory = homebridge.platformAccessory;

	// Service and Characteristic are from hap-nodejs
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerPlatform("homebridge-zipato", "Zipato", ZipatoPlatform, true);
}

zipabox.events.OnAfterConnect = function() {
	platform.log("OnAfterConnect");	
	zipabox.LoadDevices();
}

zipabox.events.OnAfterLoadDevice = function(device) {
	platform.log("OnAfterLoadDevice");	
	platform.log("" + device);
}

zipabox.events.OnAfterLoadDevices = function() {
	platform.log("OnAfterLoadDevices");	
	platform.addAccessory("Test");

	platform.log("Lights");	
	zipabox.ForEachModuleInDevice("lights", function(uuid, module){

		if(typeof module.attributes[11] !== 'undefined') {
			platform.log(uuid);
			platform.log(module.name);

			platform.addAccessory(module.name, uuid);
		}
	});
}

function ZipatoPlatform(log, config, api) {
	log("ZipatoPlatform Init");
	platform = this;

	this.log = log;
	this.config = config;
	this.accessories = [];

	zipabox.username = config["username"];
	zipabox.password = config["password"];

	zipabox.showlog = false;
	zipabox.checkforupdate_auto = true;

	if (api) {
		// Save the API object as plugin needs to register new accessory via this object.
		this.api = api;

		// Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
		// Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
		// Or start discover new accessories
		this.api.on('didFinishLaunching', zipabox.Connect);
	}
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
ZipatoPlatform.prototype.configureAccessory = function(accessory) {
	this.log(accessory.displayName, "Configure Accessory");
	var platform = this;

	// set the accessory to reachable if plugin can currently process the accessory
	// otherwise set to false and update the reachability later by invoking 
	// accessory.updateReachability()
	accessory.reachable = false;

	accessory.on('identify', function(paired, callback) {
		platform.log(accessory.displayName, "Identify!!!");
		callback();
	});

	if (accessory.getService(Service.Lightbulb)) {
		accessory.getService(Service.Lightbulb)
			.getCharacteristic(Characteristic.On)
			.on('set', function(value, callback) {
				platform.log(accessory);
				platform.log(accessory.displayName, "Light -> " + value);
				zipabox.SetDeviceValue(accessory.UUID, 11, !!value,
						function(msg) {
							callback();
						},
						function(err) {
							callback(err);
						}
					);
			});
	}

	this.accessories.push(accessory);
}

ZipatoPlatform.prototype.addAccessory = function(displayName, uuid) {
	// Prevent adding the same accessory twice
	for(var i in this.accessories) if(this.accessories[i].displayName == displayName) return;

	this.log("Add Accessory");

	var newAccessory = new Accessory(displayName, uuid);

  newAccessory.addService(Service.Lightbulb, displayName);

	this.configureAccessory(newAccessory);

	this.api.registerPlatformAccessories("homebridge-zipato", "Zipato", [newAccessory]);
}

