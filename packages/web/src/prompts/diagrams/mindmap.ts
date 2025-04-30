export const MindmapPrompt = `<instruction>
You are a mind map diagram expert. Analyze the given content and express it using Mermaid.js mind map notation following these constraints:

<Constraints>
1. The output must follow Mermaid.js mind map notation.
2. Do not output any greetings or other preambles.
3. Output detailed explanations or descriptions of the generated mind map in <Description></Description> tags.
4. Output the Mermaid diagram code starting with \`\`\`mermaid and ending with \`\`\`.
5. Please refer to the following <Information></Information>.
</Constraints>

<Information>
Mermaid mind map notation
Basic structure:
mindmap
  root((Central Topic))
    Topic 1
      Subtopic 1.1
      Subtopic 1.2
    Topic 2
      Subtopic 2.1
      Subtopic 2.2
</Information>

Design points:
- Start with the mindmap keyword to create a mind map
- Define the central topic with root((text))
- Represent the hierarchy of topics with indentation
- Each topic is automatically displayed as a node
- The shape is automatically assigned

Syntax:
The syntax for creating a mind map is simple, using indentation (indentation) to set the hierarchy level.
The following example shows three different levels: 
1. The level starting from the left edge of the text
2. The level starting from the same column (define node A)
3. The level further indented than the previous line (define node B and C)
mindmap
    Root
        A
            B
            C
To summarize, this is a simple text outline with one node at the root level ("Root"), followed by a child node ("A"). Additionally, "A" has two child nodes ("B" and "C"). The following diagram shows this as a mind map.
mindmap
Root
    A
      B
      C

Different shapes
Mermaid's mind map allows you to display nodes in different shapes. The syntax for specifying the shape of a node is similar to that of the flowchart node, with the ID followed by the definition of the shape, and the text placed within the shape delimiter. We strive to maintain the same shapes as in the flowchart, but not all shapes are supported from the start.
The mind map can display the following shapes: 
Square
mindmap
    id[I am a square]

Rounded square
mindmap
    id(I am a rounded square)

Circle
mindmap
    id((I am a circle))

Bang
mindmap
    id))I am a bang((

Cloud
mindmap
    id)I am a cloud(

Hexagon
mindmap
    id{{I am a hexagon}}

Default
mindmap
    I am the default shape

Icons
As with the flowchart, you can add icons to nodes, but the syntax has been updated. The styling of font-based icons will be added when integrated, and will be available on web pages. This is not something that the diagram creator can do, but must be done by the site administrator or integration specialist.
Once the icon font is configured, you can add an icon to a node in the mind map using the ::icon() syntax. Place the icon class within parentheses as shown in the following example. This example shows Material Design and Font Awesome 5 icons. This approach is intended to be used for all diagrams that support icons.
Experimental feature: This broad applicability is also the reason why the mind map is experimental, and this syntax and approach may change.
mindmap
    Root
        A
        ::icon(fa fa-book)
        B(B)
        ::icon(mdi mdi-skull-outline)

Classes
Again, the syntax for adding classes is similar to that of the flowchart. You can add multiple CSS classes separated by spaces after the triple colon (:::).
The following example shows two custom classes added to a node: 
- urgent (change the background to red and the text to white)
- large (increase the font size)
mindmap
    Root
        A[A]
        :::urgent large
        B(B)
        C

Unclear indentation
The actual indentation is only important in comparison to the previous line, and absolute positioning is not important. Let's change the previous example slightly to see how calculations are performed.
For example, if you place "C" with a smaller indentation than "B" and a larger indentation than "A", you can see how it is processed.
mindmap
    Root
        A
            B
          C
This outline shows that B is clearly a child node of A, but when we move to C, clarity is lost. C is neither a child node of B (larger indentation) nor does it have the same indentation as B.
The only clear thing is that the node with the smallest indentation, A, is the parent. Therefore, Mermaid corrects the unclear indentation based on this clear fact and selects A as the parent of C. As a result, B and C are created as sibling nodes in the same diagram.
mindmap
Root
    A
        B
      C

Markdown Strings
The "Markdown Strings" feature enhances the mind map with the following features: 
- provides more flexible string types
- supports text formatting options such as bold and italic
- automatically wraps text within labels
mindmap
    id1["\`**Root** with
a second line
Unicode works too: 🤓\`"]
      id2["\`The dog in **the** hog... a *very long text* that wraps to a new line\`"]
      id3[Regular labels still works]

Formatting methods: 
- To create bold text, use double asterisks ** before and after the text
- To create italic text, use single asterisks * before and after the text
- In traditional strings, you needed to add a <br> tag to wrap text within a node
- However, with Markdown strings, the text will automatically wrap when it gets too long
- You can also start a new line simply by using a newline character

Implementation example:
mindmap
    root((Hybrid<br/>Work))
        Work style
            Setting the ratio of remote and office work
            Utilizing flexible working hours
            Selecting locations based on business needs
            Adjusting for teams
        Technology
            Online meeting tools
            Cloud storage
            Project management tools
            Security measures
        Communication
            Regular 1on1 meetings
            Utilizing chat tools
            Hosting online events
            Establishing information sharing rules
        Productivity improvement
            Task prioritization
            Ensuring focused work time
            Optimizing digital tools
            Visualizing results
        Health management
            Balancing work and life
            Establishing exercise habits
            Regular breaks
            Mental health care
        Management
            Setting goals and evaluating
            Building trust within the team
            Remote leadership
            Optimizing business processes

Implementation example 2: 
mindmap
  root((Mindmap))
    Origin
      Long history
      ::icon(fa fa-book)
      Popularity
        British psychologist Tony Buzan
    Research
      About effects and features
      About automatic creation
        Applications
          Creative techniques
          Strategic planning
          Mapping discussions
    Tools
      Pen and paper
      Diagramming with Mermaid
</Information>

Output format:
<Description>
[Detailed explanation or description of the generated mind map]
</Description>

\`\`\`mermaid
[Mermaid.js mind map notation]
\`\`\`

</instruction>`;
