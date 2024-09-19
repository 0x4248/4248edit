require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' }});
window.MonacoEnvironment = { getWorkerUrl: () => proxy };

let proxy = URL.createObjectURL(new Blob([`
	self.MonacoEnvironment = {
		baseUrl: 'https://unpkg.com/monaco-editor@latest/min/'
	};
	importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');
`], { type: 'text/javascript' }));

require(["vs/editor/editor.main"], function () {
	// Function to fetch the list of words from the provided URL
	function fetchKeywords() {
		return fetch('https://raw.githubusercontent.com/dolph/dictionary/refs/heads/master/popular.txt')
			.then(response => response.text())
			.then(text => {
				let keywordsArray = text.split('\n').map(word => word.trim()).filter(word => word);

				// Helper function to capitalize the first letter of a word
				function capitalizeFirstLetter(word) {
					return word.charAt(0).toUpperCase() + word.slice(1);
				}

				// Append capitalized versions for sentence case
				let extendedKeywordsArray = [];
				keywordsArray.forEach(word => {
					extendedKeywordsArray.push(word); // Lowercase version
					extendedKeywordsArray.push(capitalizeFirstLetter(word)); // Capitalized version
				});

				// Append custom words like 'a', 'i', and their capitalized versions
				extendedKeywordsArray.push('a', 'i', 'A', 'I');
				
				return extendedKeywordsArray;
			});
	}

	const backgroundColourDark = getComputedStyle(document.documentElement).getPropertyValue('--background-colour-dark').trim();
	const backgroundColourLight = getComputedStyle(document.documentElement).getPropertyValue('--background-colour-light').trim();
	const lightGray = getComputedStyle(document.documentElement).getPropertyValue('--light-gray').trim();
	const textColour = getComputedStyle(document.documentElement).getPropertyValue('--text-colour').trim();

	// Define a custom Monaco Editor theme
	monaco.editor.defineTheme('custom-dark-theme', {
		base: 'vs-dark', // Start with a dark theme as the base
		inherit: true,   // Inherit other default properties from the base theme
		rules: [
			{ token: '', background: backgroundColourDark, foreground: textColour }, // Default background and text color
			{ token: 'comment', foreground: lightGray },
			{ token: 'keyword', foreground: '#ff79c6' },  // Example for keywords color
			{ token: 'number', foreground: '#bd93f9' },   // Example for numbers color
			{ token: 'string', foreground: '#f1fa8c' },   // Example for strings color
			{ token: 'variable', foreground: '#8be9fd' }, // Example for variables color
			// Add more token-specific rules here if needed
		],
		colors: {
			'editor.background': backgroundColourDark,
			'editor.foreground': textColour,
			'editorLineNumber.foreground': lightGray,
			'editor.selectionBackground': backgroundColourLight,
			'editorCursor.foreground': textColour,
			'editorWhitespace.foreground': lightGray
		}
	});


	// Register a new language with Monaco
	monaco.languages.register({ id: 'customLang' });

	// Function to add red underline for invalid words
	function validateText(model, keywordsArray) {
		const text = model.getValue();
		const lines = text.split('\n');
		let markers = [];

		for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
			const words = lines[lineNumber].split(/\s+/);
			for (let i = 0; i < words.length; i++) {
				const word = words[i].replace(/[.,;!"'1234567890(){}[\]]/g, ''); // Remove punctuation
				if (word && !keywordsArray.includes(word)) {
					markers.push({
						severity: monaco.MarkerSeverity.Error,
						startLineNumber: lineNumber + 1,
						startColumn: text.indexOf(word, text.indexOf(lines[lineNumber])) + 1,
						endLineNumber: lineNumber + 1,
						endColumn: text.indexOf(word, text.indexOf(lines[lineNumber])) + word.length + 1,
						message: `'${word}' is not a valid word`
					});
				}
			}
		}

		monaco.editor.setModelMarkers(model, 'spellcheck', markers);
	}

	// Fetch the keywords and set up Monaco editor
	fetchKeywords().then(keywordsArray => {
		monaco.languages.registerCompletionItemProvider('customLang', {
			provideCompletionItems: function(model, position) {
				// Create completion items based on the keywordsArray
				var suggestions = keywordsArray.map(function(word) {
					return {
						label: word,
						kind: monaco.languages.CompletionItemKind.Keyword,
						insertText: word,
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column - 1,
							endLineNumber: position.lineNumber,
							endColumn: position.column
						}
					};
				});
				return { suggestions: suggestions };
			}
		});

		// Create the editor with the custom language and autocomplete
		let editor = monaco.editor.create(document.getElementById('container'), {
			value: [].join('\n'),
			language: 'customLang',
			theme: 'custom-dark-theme',
			wordWrap: 'on'
		});
		function saveToFile() {
			const text = editor.getValue();
			const blob = new Blob([text], { type: 'text/plain' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = 'document.txt'; // The default file name
			link.click();
		}
	
		// Helper function to create a new document (clear editor content)
		function newDocument() {
			editor.setValue(''); // Clears the content of the editor
		}
	
		// Add keyboard shortcuts
		window.addEventListener('keydown', function (event) {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
				event.preventDefault(); // Prevent the default Ctrl+S action
				saveToFile();           // Trigger the save function
			}
	
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
				event.preventDefault(); // Prevent the default Ctrl+N action
				newDocument();          // Trigger the new document function
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
				event.preventDefault(); // Prevent the default Ctrl+O action
				document.getElementById('fileInput').click(); // Trigger the file input click event
			}
		});
		//Add a button to download the editor content
		let downloadButton = document.createElement('button');
		downloadButton.textContent = 'Download';


		// Debounce validation function
		let timeoutId;
		const debounceDelay = 500; // Delay in milliseconds

		editor.onDidChangeModelContent(function() {
			// Clear the previous timeout
			clearTimeout(timeoutId);

			// Set a new timeout to delay the validation
			timeoutId = setTimeout(function() {
				validateText(editor.getModel(), keywordsArray);
			}, debounceDelay);
		});

		// Initial validation when the editor loads
		validateText(editor.getModel(), keywordsArray);
	});



});
