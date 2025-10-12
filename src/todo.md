### Todo
- [ ] Split content into pages by number of sentences 
- [ ] format xxx.md as todo list
- [ ] format Texts.md as todo list
- [ ] renaming a page/text shall rename all of the files
- [ ] keep unedited text as a separate doc in texts folder
- [x] meta shall always be at the end of file
- Codex instad of root

### Actions
- All actions on one sidebar
- Action set changes depending on the:
    1) File meta data
    2) cursor position
    3) selection presence / contents 

### Techdebt
- [ ] Single locations for lestenind for scrolls (reattaching selection menu)



### Done

- [x] "Make this a text" button in bottom sidebar (visible if metaInfo is empty)
- [x] Split content into pages
- [x] Create 
    Texts/
        Texts.md
        xxx/
            xxx.md
            Pages/
                0000-xxx.md
                0001-xxx.md
                ...
                9999-xxx.md
- [x] xxx.md shall link to every page
- [x] Texts.md shall link to xxx.md
- [x] Texts.md shall have { fileType: ROOT } in metaInfo
- [x] xxx.md shall have { fileType: TEXT-ROOT } in metaInfo
- [x] Pages/... shall have { fileType: PAGE } in metaInfo
- [x] "←" and "→" buttons to go between the pages

