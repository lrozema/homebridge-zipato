# homebridge-zipato

Supports Zipabox or Zipatile on HomeBridge Platform

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install zipabox using: npm install -g zipabox
3. Install this plugin using: npm install -g homebridge-zipato
4. Update your configuration file. See below for an example.

# Configuration

Configuration sample:

 ```
	"platforms": [ 
		{
			"platform": "Zipato",
			"username": "[ZIPABOX LOGIN]",
			"password": "[ZIPABOX PASSWORD]",
			"devices": [ "scenes", "lights" ],
			"filters": [ "Relay 1", "Relay 2" ],
			"replace": { "Schemerlampen": "Lights", "Zonweering": "Sunscreen" }
		}
	]
```
## Devices

One can prevent the scenes or the lights devices to be processed by removing them from the 'devices' array in the configuration.

## Filters

To filter specific items to be exposed throught Homebridge its Zipato name can be added in the 'filters' array in the configuration.

## String replace

Renaming exposed items can be done using the 'replace' key/value store in the configuration. It will do simple string replacements, so also partial strings will be replaced.

