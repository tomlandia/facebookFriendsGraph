var gui = require('nw.gui');
var Window = gui.Window.get();

//open in default browser instead of clumpsy nw.js window
window.open = gui.Shell.openExternal.bind(gui.Shell); 

//Copy-paste on Mac
if(process.platform == 'darwin') {
    var nativeMenuBar = new gui.Menu({ type: "menubar" });
    nativeMenuBar.createMacBuiltin("facebookFriendsGraph");
    Window.menu = nativeMenuBar;
}
