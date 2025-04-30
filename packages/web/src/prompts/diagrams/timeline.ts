export const TimelinePrompt = `<instruction>
Please create a system prompt using Mermaid.js timeline diagram notation, referring to the information on the following website. Follow these constraints:

1. The output must strictly follow Mermaid.js timeline diagram notation.
2. Do not output any greetings or other preambles.
3. Output detailed explanations or descriptions of the generated timeline diagram within <Description></Description> tags.
4. Output the Mermaid diagram code starting with \`\`\`mermaid and ending with \`\`\`.
5. Please refer to the following <Information></Information> for your output.

<Information>
Syntax
Syntax for creating a timeline diagram: 
1. Start with the "timeline" keyword to tell mermaid to create a timeline diagram.
2. You can add a title to the timeline by writing the title text after the "title" keyword.
3. Next, add the timeline data: 
   - Always start with a time period
   - Followed by a colon (:)
   - Then write the text of the event
   - Optionally add a second colon and the text of the event
   - You can set one or more events for a time period

{time period} : {event}
Or
{time period} : {event} : {event}
Or
{time period} : {event}
              : {event}
              : {event}

Note: Time periods and events are simple text, not limited to numbers.
Let's look at the syntax example above.
(Note: Although the previous example is not provided, the important point is that time periods and events can use any text, not just numbers. For example, "2023" can be used as a time period, not just "2023".)
timeline
    title The history of social media platforms
    2002 : The launch of LinkedIn
    2004 : The launch of Facebook : The launch of Google
    2005 : The launch of Youtube
    2006 : The launch of Twitter

This way, you can generate a timeline diagram using text outlines. The order of time periods and events is important for the following reasons: 
Horizontal placement of the timeline: 
- The first time period is placed on the left side of the timeline
- The last time period is placed on the right side of the timeline
Vertical placement within a specific time period: 
- The first event is placed at the top of the time period
- The last event is placed at the bottom of the time period
This way, the order of input is reflected in the visual placement.

Grouping of time periods in sections/ages
You can group time periods in sections/ages by writing the section name after the "section" keyword.
Until a new section is defined, all subsequent time periods are placed in that section.
If a section is not defined, all time periods are placed in the default section.
Let's look at the example of time periods grouped in sections.
timeline
    title The timeline of the Industrial Revolution
    section 17-20th century section
        Industry 1.0 : Mechanical water power, steam power
        Industry 2.0 : Electricity<br>Internal combustion engine<br>Mass production
        Industry 3.0 : Electronic devices<br>Computers<br>Automation
    section 21st century section
        Industry 4.0 : Internet<br>Robotics<br>Internet of Things
        Industry 5.0 : Artificial intelligence<br>Big data<br>3D printing

As you can see, time periods are placed in each section, and sections are placed in the order defined.
All time periods and events in a specific section follow the same color scheme. This is done to make the relationship between time periods and events clearer.

Wrapping of text for long time-periods or events
By default, if the text of a time period or event is too long, it will be wrapped. This is done to avoid the text from overflowing the diagram.
You can also force a line break using the <br> tag. Use the following approximate guideline for the <br> tag:
Let's look at another example with longer time periods and events.
timeline
    title The history of the United Kingdom
    section Stone Age
        BC 7600 : The oldest house in the United Kingdom was built in Scotland at the Orkney Islands.
        BC 6000 : The sea level rose, and the United Kingdom became an island. The people living on this land were hunter-gatherer tribes.
    section Bronze Age
        BC 2300 : People from Europe came to the United Kingdom and settled. They brought agricultural and metalworking technologies.
        BC 2200 : New styles of pottery and burial methods appeared.
        BC 2200 : The main construction project at Stonehenge was completed. People started burying their dead in stone circles.
        BC 2200 : The first metal products were made in the United Kingdom. Other great things happened. It was a good time to live.

Example: 
timeline
    title MermaidChart 2023 Timeline
    section 2023 Q1 <br> Release Personal Tier
        Bullet 1 : sub-point 1a : sub-point 1b
            : sub-point 1c
        Bullet 2 : sub-point 2a : sub-point 2b
    section 2023 Q2 <br> Release XYZ Tier
        Bullet 3 : sub-point <br> 3a : sub-point 3b
            : sub-point 3c
        Bullet 4 : sub-point 4a : sub-point 4b

Styling of time periods and events
As explained earlier, each section has a color scheme, and the time periods and events in each section follow the same color scheme.
However, if a section is not defined, there are two possibilities:
- Style each period individually, meaning each period (and its corresponding event) will have its own unique color. This is the default behavior.
%%{init: { 'logLevel': 'debug', 'theme': 'base', 'timeline': {'disableMulticolor': true}}}%%
timeline
    title History of Social Media Platform
        2002 : LinkedIn
        2004 : Facebook : Google
        ...

Customizing Color scheme
You can customize the color scheme using theme variables from cScale0 to cScale11. This changes the background color. Mermaid allows you to set unique colors for up to 12 sections. The cScale0 variable controls the value for the first section or period, cScale1 controls the value for the second section, and so on. If there are more than 12 sections, the color scheme will be reused.

If you also want to change the foreground color (text color) of sections, you can use the corresponding theme variables from cScaleLabel0 to cScaleLabel11.

Note: The default values for these theme variables are taken from the selected theme. If you want to override the default values, you can add values for custom theme variables using the initialize call.

Example:
Let's override the default values for variables from cScale0 to cScale2:
%%{init: { 'logLevel': 'debug', 'theme': 'default' , 'themeVariables': {
            'cScale0': '#ff0000', 'cScaleLabel0': '#ffffff',
            'cScale1': '#00ff00',
            'cScale2': '#0000ff', 'cScaleLabel2': '#ffffff'
    } } }%%
    timeline
    title History of Social Media Platform
        2002 : LinkedIn
        2004 : Facebook : Google
        ...

Themes
Mermaid has many pre-defined themes, and you can choose the one you like.
Note: Actually, you can also override the existing theme variables to create your own custom theme. For more details on the theme settings, please refer to the following link.
Here are the different theme options: 
- base
- forest
- dark
- default
- neutral

Example:
%%{init: { 'logLevel': 'debug', 'theme': 'base' } }%%
Or
%%{init: { 'logLevel': 'debug', 'theme': 'forest' } }%%
Or
%%{init: { 'logLevel': 'debug', 'theme': 'dark' } }%%
Or
%%{init: { 'logLevel': 'debug', 'theme': 'default' } }%%
Or
%%{init: { 'logLevel': 'debug', 'theme': 'neutral' } }%%
</Information>

Output format:
<Description>
[Detailed explanation or description of the timeline diagram to be generated]
</Description>

\`\`\`mermaid
[Mermaid.js timeline diagram notation]
\`\`\`

</instruction>`;
