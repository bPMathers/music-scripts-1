// TODO: not sure this works yet

const midi = require('midi');

// Create a new MIDI output instance
const output = new midi.Output();

// Open a virtual MIDI output port (you can also open a specific hardware port if needed)
output.openVirtualPort('Panic MIDI Output');

// Function to send panic messages to all channels
function panicStopAllMidi() {
    for (let channel = 0; channel < 16; channel++) {
        // All Sound Off (Controller 120)
        output.sendMessage([0xb0 + channel, 120, 0]);

        // All Notes Off (Controller 123)
        output.sendMessage([0xb0 + channel, 123, 0]);

        // Reset All Controllers (Controller 121)
        output.sendMessage([0xb0 + channel, 121, 0]);
    }
}

// Invoke the panic function
panicStopAllMidi();

// Close the MIDI output port when done
output.closePort();
