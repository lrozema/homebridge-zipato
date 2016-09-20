var zipabox = require("zipabox");
var Accessory, Service, Characteristic, platform;

'use strict';

var ZIPATO_HSLIDER = 8
var ZIPATO_SWITCH = 11

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

	// Iterate over all Zipato devices (actually module groups)
	zipabox.ForEachDevice(function(device) {
		// Skip all devices that is not in the configured device list
		if(platform.config["devices"] !== undefined && platform.config["devices"].indexOf(device.name) < 0) return;

		// Iterate overall Zipato modules within a device (module group)
		zipabox.ForEachModuleInDevice(device.name, function(uuid, module){
			// Skip all modules that are in the configured filter list
			if(platform.config["filters"] !== undefined && platform.config["filters"].indexOf(module.name) >= 0) return;

			// Figure out the best way to have HomeKit handle this Zipato module
			if(module.attributes !== undefined && typeof module.attributes[ZIPATO_HSLIDER] !== 'undefined') {
				platform.addAccessory(Service.Lightbulb, module, uuid);
			}
			else if(device.name == "scenes" || typeof module.attributes[ZIPATO_SWITCH] !== 'undefined') {
				platform.addAccessory(Service.Switch, module, uuid);
			}
		});
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

	if(config["localip"] !== undefined) {
		log("Using local IP "+config["localip"]);
		zipabox.SetLocalIP(config["localip"]);
	}

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
	platform.log(accessory.displayName, "Configure Accessory");

	// By default the accessory is not reachable, updated once Zipato is reachable
	accessory.reachable = false;

	accessory.on('identify', function(paired, callback) {
		platform.log(accessory.displayName, "Identify");
		callback();
	});

	if (accessory.getService(Service.Switch)) {
		accessory.getService(Service.Switch).getCharacteristic(Characteristic.On)
			.on('set', function(value, callback) {
				if(! accessory.isScene) {
					// Simply switch the device (convert 0/1 to false/true)
					zipabox.SetDeviceValue(accessory.UUID, ZIPATO_SWITCH, !!value,
							function(msg) {
								callback();
							},
							function(err) {
								callback(err);
							});
				} else {
					// Only run a scene when it is turned on
					if (!value) {
						callback();
						return;
					}

					// Run the actual scene
					zipabox.RunUnLoadedScene(accessory.UUID,
							function(msg) {
								callback();

								// Automatically turn back off after half a second
								setTimeout(function() {
									accessory.getService(Service.Switch).setCharacteristic(Characteristic.On, 0);
								}, 500);
							},
							function(err) {
								callback(err);
							});
				}
			});
	}

	if (accessory.getService(Service.Lightbulb)) {
		accessory.getService(Service.Lightbulb)
			.getCharacteristic(Characteristic.On)
			.on('set', function(value, callback) {
				// In case we are switching on but the brightness is zero we go all in
				if(value && !accessory.brightness) accessory.brightness = 100;

				// Use the brightness to switch between states
				zipabox.SetDeviceValue(accessory.UUID, ZIPATO_HSLIDER, value?accessory.brightness:0,
						function(msg) {
							callback();
						},
						function(err) {
							callback(err);
						});
			});
		accessory.getService(Service.Lightbulb)
			.getCharacteristic(Characteristic.Brightness)
			.on('set', function(value, callback) {
				zipabox.SetDeviceValue(accessory.UUID, ZIPATO_HSLIDER, value,
						function(msg) {
							accessory.brightness = value;
							callback();
						},
						function(err) {
							callback(err);
						});
			})
			.on('get', function(callback) {
				if(accessory.brightness === undefined) accessory.brightness = 0;
				callback(accessory.brightness);
			});
	}

	this.accessories.push(accessory);
}

ZipatoPlatform.prototype.updateAccessory = function(accessory, module) {
	// Used to detect if this is a scene
	accessory.isScene = (module.uri_run !== undefined);

	// Consider the accessory reachable since Zipato still has it
	accessory.updateReachability(true);
}

ZipatoPlatform.prototype.addAccessory = function(service, module, uuid) {
	// Prevent adding the same accessory twice
	for(var i in this.accessories) if(this.accessories[i].UUID == uuid) {
		this.updateAccessory(this.accessories[i], module);
		return;
	}

	// Apply replace configuration onto module name
	var name = module.name;
	if(this.config["replace"] !== undefined) {
		for(var key in this.config["replace"]) {
			platform.log(key);
			platform.log(name);
			name = name.replace(key, this.config["replace"][key]);
			platform.log(name);
		}
	}

	var newAccessory = new Accessory(name, uuid);

	// Setup the initial service that we want to use for this accessory
	newAccessory.addService(service, name);

	// Configure the accessory (this sets up all the relevant callbacks
	this.configureAccessory(newAccessory);

	// A new accessory is created by Zipato so always reachable
	this.updateAccessory(newAccessory, module);

	this.api.registerPlatformAccessories("homebridge-zipato", "Zipato", [newAccessory]);
}

