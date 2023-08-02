# Otto Tabs [![CI](https://github.com/borsini/chrome-otto-tabs/actions/workflows/ci.yml/badge.svg)](https://github.com/borsini/chrome-otto-tabs/actions/workflows/ci.yml)

>Smart tabs management

As a developper I often find myself struggling with too many open tabs.  
Clicking on a link in an email or from any chat software creates each time a new tab. On top of this, add some Google, Wikipedia Github or Stack Overflow tabs and your browser looks like a mess 😤.

It needs regular manual intervention to keep a clean browser. That is why I created Otto Tabs.

## Compatibility

Otto Tabs works with all chromium based browsers ([Chrome](https://www.google.fr/chrome), [Opera](https://www.opera.com), [Vivaldi](https://vivaldi.com)) that support extensions.  
Check this link to install with Opera : https://addons.opera.com/en/extensions/details/install-chrome-extensions/

## Features

Those feature can be toggled on and off. By default the first two are enabled.

### Group/stack tabs automatically

Tabs from same domain are grouped next to each other or stacked (Vivaldi).

Behavior in Chrome
![](pictures/grouped.gif)


Behavior in Vivaldi
![](pictures/stacked.gif)

### Remove duplicate tabs

Tabs with the same url are closed. Only last open tab is kept.

![](pictures/duplicated.gif)

### Remove older tabs

No more than 5 tabs from the same domain are open at the same time.

![](pictures/same_host.gif)

## Feedback

Feel free to fill a ticket [here](https://github.com/Benlenem/chrome-otto-tabs/issues) !

## Want to build and install the extension yourself ?

* Install [yarn](https://classic.yarnpkg.com/en/docs/install/)
* Download or clone the project
* Using a terminal go to the project root folder
* Type `yarn archive`. This will execute the unit tests and create a `build` folder. This folder contains all the extension files.
* Go to either vivaldi://extensions/ or chrome://extensions/ according to your browser
* Install the extension as unpacked by selecting the `build` folder

