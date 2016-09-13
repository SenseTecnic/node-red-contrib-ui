module.exports = function(RED) {

    var ui = require('../ui')(RED);

    function ToastNode(config) {
        RED.nodes.createNode(this, config);

        this.on('input', function(msg) {
            ui.emit('show-toast', {
                title: msg.topic,
                message: msg.payload
            });
        });
    }

    RED.nodes.registerType("legacy_ui_toast", ToastNode);
};