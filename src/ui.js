var inited = false;

module.exports = function(RED) {
	if (!inited) {
		inited = true;
		init(RED.server, RED.httpAdmin);
	}
	
	return { add: add, emit: emit }
};

var uiPath = '/ui';
var express = require('express'),
	socketio = require('socket.io'),
	path = require('path'),
	events = require('events');
	
var homeTab = {
	header: "Home",
	icon: "home",
	items: []
};

var updateValueEventName = 'update-value';

var io = undefined;
var controlValues = {};
var ev = new events.EventEmitter();

function emit(event, data) {
	io.emit(event, data);
}

function add(node, group, control) {
	var remove = addControl(group, control);
	control.id = node.id;
	
	node.on("input", function(msg) {
		controlValues[node.id] = msg.payload;
		
		io.emit(updateValueEventName, {
			id: node.id,
			value: msg.payload
		});
	});
	
	var handler = function (msg) {
		if (msg.id !== node.id) return;
		
		node.send({payload: msg.value});
		controlValues[msg.id] = msg.value;
		
		//fwd event
		io.emit(updateValueEventName, msg);
	};
	
	ev.on(updateValueEventName, handler);
	
	return function() {
		ev.removeListener(updateValueEventName, handler);
		remove();
	}
}

function init(server, app) {	
	io = socketio(server, {path: uiPath + '/socket.io'});
	app.use(uiPath, express.static(path.join(__dirname, "public")));

	var vendor_packages = ['angular', 'angular-animate', 'angular-aria', 'angular-material', 'angular-material-icons'];
	vendor_packages.forEach(function (p) {
		app.use(uiPath+'/vendor/'+p, express.static(path.join(__dirname, '../node_modules/', p)));
	});

	io.on('connection', function(socket) {
		updateUi(socket);
		
		socket.on(updateValueEventName, 
			ev.emit.bind(ev, updateValueEventName));
		
		socket.on('ui-replay-state', function() {
			var ids = Object.getOwnPropertyNames(controlValues);
			ids.forEach(function (id) {
				socket.emit(updateValueEventName, {
					id: id,
					value: controlValues[id]
				})
			});
			
			socket.emit('ui-replay-done');
		});
	});
}

var updateUiPending = false;
function updateUi(to) {
	if (!to) {
		if (updateUiPending) return; 
		updateUiPending = true;
		to = io;
	}

	process.nextTick(function() {
		to.emit('ui-controls', {
			title: 'Home',
			tabs: [homeTab]
		});
		updateUiPending = false;
	});
}

function findGroup(header) {
	for (var j=0; j<homeTab.items.length; j++) {
		var group = homeTab.items[j];
		if (group.header === header) 
			return group;
	}
}

function addControl(groupHeader, control) {
	if (typeof control.type !== 'string') return;
	groupHeader = groupHeader || 'Default';
	
	var group = findGroup(groupHeader);
	if (!group) {
		group = {
			header: groupHeader,
			items: []
		}
		homeTab.items.push(group);
	}
	group.items.push(control);
	
	updateUi();
	
	return function() {
		var index = group.items.indexOf(control);
		if (index >= 0) {
			group.items.splice(index, 1);
			
			if (group.items.length === 0) {
				index = homeTab.items.indexOf(group);
				if (index >= 0) {
					homeTab.items.splice(index, 1);
				}
			}
			
			updateUi();
		}
	}
}