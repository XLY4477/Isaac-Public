# Isaac Web App shell

This folder contains the locally hosted web interface, touch controls, PWA shell, and Ruffle runtime. It does not include the game movie file.

To run it, place a game SWF that you are authorized to use at `Isaac-WebApp/game.swf`, then serve the repository over HTTPS or localhost. The file is ignored by Git and is not part of this public repository.

The UI and runtime are served from this site; the shell does not load remote analytics, ads, or third-party scripts. Offline caching covers same-origin assets only. Initial loading and iPhone Safari compatibility depend on the user's own SWF and browser.
