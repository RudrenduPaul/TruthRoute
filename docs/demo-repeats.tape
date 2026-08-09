Output "/tmp/truthroute-demo/docs/demo-repeats.gif"
Set FontSize 16
Set Width 760
Set Height 260
Set Theme "Dracula"
Set WindowBar Colorful
Set WindowBarSize 36

Type "export PS1='$ '"
Enter
Sleep 300ms

Type `truthroute compare "What is the boiling point of water at sea level?" --models openai,anthropic,gemini --dry-run --repeats 3`
Enter
Sleep 3s
