![SADISS](https://sadiss.net/api/logo_black.png)

# A socially aggregated distributed sound system.

SADISS is a set of web applications developed in the research project ‘The Choir & the Sound System’ at the Institute for Composition, Conducting and Computermusic at Anton Bruckner university (Linz, Austria) that bundles smartphones into monumental yet intricate sound or performance systems.

Take a look at [sadiss.net](https://sadiss.net/) to get an idea.

Check out our [wiki](https://github.com/wildyeast/sadiss/wiki) to get an even better idea about SADISS.

### Get the apps

[<img src="https://user-images.githubusercontent.com/32699708/222488341-8fadcd96-553d-4a79-9f54-1e45078925ec.png" width="143" height="45">](https://apps.apple.com/at/app/sadiss-client/id1670003024?l=en)
[![image](https://user-images.githubusercontent.com/32699708/222488601-df1e1887-6b0c-4b46-a53f-df8f3cf24b7c.png)](https://play.google.com/store/apps/details?id=net.sadiss_client.app)

## License

SADISS is released under the GNU Affero General Public License ([AGPL](LICENSE)). It allows anyone to freely download, modify, run and distribute the software. Any distribution must ship its source code to the user. If you run a modified version of SADISS on a server, your server must allow users to download the source code corresponding to the modified version.

## Project status

SADISS is a work in progress. A dedicated research group led by [Volkmar Klien](https://www.volkmarklien.com) is continously developing this project. We are currently testing the software in performances with a limited number of participants.

## Architecture

SADISS is comprised of four applications.

server, a Node.js app, is supposed to run on a web server. It is the backbone of the SADISS network and coordinates the distribution of instructions to the registered phones.

admin client, a Vue.js app, is supposed to run in the browser. Performers will use it to upload instruction sets and send control messages to the server.

app, an Ionic app, runs on Android and iOS phones. It is available in the vendor stores for all participants to download.

max, a Max/MSP patcher, intended to be the main control suite for SADISS.

## Links

[![Hypercommit](https://img.shields.io/badge/Hypercommit-DB2475)](https://hypercommit.com/sadiss)
