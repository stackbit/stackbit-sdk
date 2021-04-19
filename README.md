# Stackbit SDK

Stackbit SDK contains set of utilities to work with stackbit.yaml file. 


## Add to your project

```bash
npm install @stackbit/sdk
```


## Generate stackbit.yaml

Create a `FileBrowser` with `FileSystemFileBrowserAdapter` or `GitHubFileBrowserAdapter`:

- Analyzing a local project:

    ```js
    import { FileSystemFileBrowserAdapter, FileBrowser } from '@stackbit/sdk';
  
    const fileBrowserAdapter = new FileSystemFileBrowserAdapter({ dirPath: inputDir });
    const fileBrowser = new FileBrowser({ fileBrowserAdapter });
    ```

- Analyzing a remote GitHub project:

    ```js
    import { GitHubFileBrowserAdapter, FileBrowser } from '@stackbit/sdk';
  
    const fileBrowserAdapter = new GitHubFileBrowserAdapter({
        owner: 'stackbit',
        repo: 'theme',
        branch: 'master',
        auth: GITHUB_PERSONAL_ACCESS_TOKEN
    });
    const fileBrowser = new FileBrowser({ fileBrowserAdapter });
    ```

Then, pass the `fileBrowser` to the `analyzeSite()` method, get the result and save the `config` as `stackbit.yaml`:

```js
import { writeConfig, analyzeSite } from '@stackbit/sdk';

const analyzeResult = await analyzeSite({ fileBrowser });
await writeConfig({ dirPath: inputDir, config: analyzeResult.config });
```


## Validate stackbit.yaml

Load and validate `stackbit.yaml`. Any errors will be returned within the `errors` array.

```js
import { loadConfig } from '@stackbit/sdk';

const configResult = await loadConfig({ dirPath: inputDir });

configResult.errors.forEach((error) => {
    console.log(error.message);
});
```

If `configResult.config` is not null, pass it to load and validate web-site's content. Any errors will be returned within the `errors` array, and loaded content within the `contentItems`:

```js
import { loadContent } from '@stackbit/sdk';

if (configResult.config) {
    return;
}

const contentResult = await loadContent({ dirPath: inputDir, config: configResult.config });

contentResult.contentItems.forEach((contentItem) => {
    console.log(contentItem.__metadata.filePath);
});

contentResult.errors.forEach((error) => {
    console.log(error.message);
});
```
