# NewsPage

This is a simple blog/news page generator written in TypeScript. It reads devlog files from a specified directory, extracts the latest entries, and generates an HTML page to display them within milliseconds.

## Getting Started
### Fast Setups
1. Go to the [releases](https://github.com/agentquackyt/NewsPage/releases) and download the latest installer. Run the installer and follow the prompts to set up the application on your system. 
2. Once installed, you may then need to open in a terminal window in your project directory and run `newspage` to launch the CLI tool.
3. If you are first starting the application, you probably want to select `Configure site` and follow the prompts to set up your site configuration. This will create a `newspage.config.json` file in the current directory with your settings.
4. Then select `Start dev server` to start the development server. You then open the provided editor URL in your browser to see the generated news page. 
5. If you now create or update articles, and then click `save` and then the `Rebuild Site` button in the editor, the news page will be regenerated with the latest articles.
6. If you now want your static page generated, end the dev server and then select `Build static site` and follow the prompts to specify the output directory for the static files. The generated static site will be saved in the specified directory, which you can then deploy to your hosting provider. 

### Manual Setup
1. Make sure you have bun installed on your system. You can download it from [https://bun.sh](https://bun.sh).
2. Clone this repository
    ```bash
    git clone https://github.com/agentquackyt/NewsPage.git
    ```
3. Navigate to the project directory and install dependencies
    ```bash
    bun install
    ```
4. Run the application
    ```bash
    bun run start
    ```
5. Follow the same steps as in the fast setup to configure your site and start the dev server.

## Flavortown
In addition to the basic functionality, NewsPage also includes a "Flavortown" program. Just execute `flavortown.exe` in the project directory and enter your api key when prompted. 

This will fetch all the devlogs from your project and save them as articles in the `articles` directory. You can then run the program again to generate an HTML page that displays all the articles.

