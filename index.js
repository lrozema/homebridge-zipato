var zipabox = require("zipabox");
var Accessory, Service, Characteristic, platform;

'use strict';

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

	platform.log("Lights");	
	zipabox.ForEachModuleInDevice("lights", function(uuid, module){
		if(typeof module.attributes[8] !== 'undefined') {
			platform.addAccessory(Service.Lightbulb, module, uuid);
		}
		else if(typeof module.attributes[11] !== 'undefined') {
			platform.addAccessory(Service.Switch, module, uuid);
		}
	});

	platform.log("Scenes");	
	zipabox.ForEachModuleInDevice("scenes", function(uuid, module){
		platform.addAccessory(Service.Switch, module, uuid);
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
	accessory.reachable = true; // false;

	accessory.on('identify', function(paired, callback) {
		platform.log(accessory.displayName, "Identify!!!");
		callback();
	});

	if (accessory.getService(Service.Switch)) {
		// FIXME: change 11 and 8 to the right ENUM
		// When uri_run is defined it is a Scene, otherwise a regular Switch
		if(! accessory.isScene) {
			accessory.getService(Service.Switch)
				.getCharacteristic(Characteristic.On)
				.on('set', function(value, callback) {
					zipabox.SetDeviceValue(accessory.UUID, 11, !!value,
							function(msg) {
								callback();
							},
							function(err) {
								callback(err);
							}
							);
				});
		} else {
			accessory.getService(Service.Switch)
				.getCharacteristic(Characteristic.On)
				.on('set', function(value, callback) {
					platform.log("Scene!");
					platform.log(accessory.displayName);
					zipabox.RunUnLoadedScene(accessory.UUID,
							function(msg) {
								platform.log("Ok!");
								callback();
							},
							function(err) {
								platform.log("Error!");
								callback(err);
							}
							);
				})
				.on('get', function(callback) {
					callback(0);
				});
		}
	}

	if (accessory.getService(Service.Lightbulb)) {
		accessory.getService(Service.Lightbulb)
			.getCharacteristic(Characteristic.On)
			.on('set', function(value, callback) {
				// In case we are switching on but the brightness is zero we go all in
				if(value && !accessory.brightness) accessory.brightness = 100;

				// Use the brightness to switch between states
				zipabox.SetDeviceValue(accessory.UUID, 8, value?accessory.brightness:0,
						function(msg) {
							callback();
						},
						function(err) {
							callback(err);
						}
						);
			});
		accessory.getService(Service.Lightbulb)
			.getCharacteristic(Characteristic.Brightness)
			.on('set', function(value, callback) {
				zipabox.SetDeviceValue(accessory.UUID, 8, value,
						function(msg) {
							accessory.brightness = value;
							callback();
						},
						function(err) {
							callback(err);
						}
						);
			})
			.on('get', function(callback) {
				if(accessory.brightness === undefined) accessory.brightness = 0;
				callback(accessory.brightness);
			});
	}

	this.accessories.push(accessory);
}

ZipatoPlatform.prototype.addAccessory = function(service, module, uuid) {
	// Prevent adding the same accessory twice
	for(var i in this.accessories) if(this.accessories[i].UUID == uuid) {
		this.accessories[i].module = module;
		return;
	}

	var newAccessory = new Accessory(module.name, uuid);

	// Used to detect if this is a scene
	newAccessory.isScene = (module.uri_run !== undefined);

	newAccessory.addService(service, module.name);

	this.configureAccessory(newAccessory);

	this.api.registerPlatformAccessories("homebridge-zipato", "Zipato", [newAccessory]);
}

