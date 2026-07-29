import { audio } from './audio.js';

export class UI {
    constructor(container) {
        this.container = container;
        
        this.elements = {
            crosshair: document.getElementById('crosshair'),
            interactPrompt: document.getElementById('interact-prompt'),
            interactLabel: document.getElementById('interact-label'),
            
            hud: document.getElementById('hud'),
            moraleFill: document.getElementById('morale-fill'),
            moraleValue: document.getElementById('morale-value'),
            
            objectiveDisplay: document.getElementById('objective-display'),
            objectiveText: document.getElementById('objective-text'),
            
            inventoryDisplay: document.getElementById('inventory-display'),
            inventoryItems: document.getElementById('inventory-items'),
            
            dialogueContainer: document.getElementById('dialogue-container'),
            dialogueBox: document.getElementById('dialogue-box'),
            dialogueSpeaker: document.getElementById('dialogue-speaker'),
            dialogueText: document.getElementById('dialogue-text'),
            dialogueChoices: document.getElementById('dialogue-choices'),
            dialogueContinue: document.getElementById('dialogue-continue'),
            
            narrationContainer: document.getElementById('narration-container'),
            narrationText: document.getElementById('narration-text'),
            narrationContinue: document.getElementById('narration-continue'),
            
            titleCard: document.getElementById('title-card'),
            titleMain: document.getElementById('title-main'),
            titleSub: document.getElementById('title-sub'),
            
            cutsceneContainer: document.getElementById('cutscene-container'),
            cutsceneText: document.getElementById('cutscene-text'),
            
            fadeOverlay: document.getElementById('fade-overlay'),
            letterboxTop: document.getElementById('letterbox-top'),
            letterboxBottom: document.getElementById('letterbox-bottom')
        };
        
        this._typewriterIds = 0;
        this._activeTypewriters = new Set();
        this._inventory = new Map();
        
        this._boundListeners = [];
    }
    
    async _typewrite(element, text, speed = 30) {
        const id = ++this._typewriterIds;
        this._activeTypewriters.add(id);
        
        element.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'typewriter-cursor';
        cursor.textContent = '_';
        element.appendChild(cursor);
        
        const textNode = document.createTextNode('');
        element.insertBefore(textNode, cursor);
        
        return new Promise((resolve) => {
            let index = 0;
            
            const typeNext = () => {
                if (!this._activeTypewriters.has(id)) {
                    resolve();
                    return;
                }
                
                if (index < text.length) {
                    const char = text.charAt(index);
                    textNode.nodeValue += char;
                    if (char !== ' ' && index % 2 === 0) audio.playTypeClick();
                    index++;
                    setTimeout(typeNext, speed);
                } else {
                    this._activeTypewriters.delete(id);
                    if (cursor.parentNode === element) {
                        element.removeChild(cursor);
                    }
                    resolve();
                }
            };
            
            typeNext();
        });
    }

    _cancelTypewriters() {
        this._activeTypewriters.clear();
    }

    async waitForKey(key = ' ') {
        return new Promise(resolve => {
            const handler = (e) => {
                if (e.key.toLowerCase() === key.toLowerCase() || e.key === key) {
                    cleanup();
                    resolve();
                }
            };
            
            const cleanup = () => {
                window.removeEventListener('keydown', handler);
                this._boundListeners = this._boundListeners.filter(l => l.handler !== handler);
            };
            
            window.addEventListener('keydown', handler);
            this._boundListeners.push({ type: 'keydown', target: window, handler, cleanup });
        });
    }

    async showDialogue(speaker, text, choices = null) {
        this._cancelTypewriters();
        
        const { dialogueContainer, dialogueSpeaker, dialogueText, dialogueChoices, dialogueContinue } = this.elements;
        
        dialogueContainer.classList.remove('screen-hidden');
        dialogueContinue.classList.add('screen-hidden');
        dialogueChoices.innerHTML = '';
        dialogueChoices.classList.add('screen-hidden');
        
        dialogueSpeaker.textContent = speaker;
        dialogueSpeaker.className = '';
        if (speaker) {
            const colorClass = `speaker-${speaker.toLowerCase().replace(/\s+/g, '')}`;
            dialogueSpeaker.classList.add(colorClass);
        }
        
        await this._typewrite(dialogueText, text, 25);
        
        if (choices && choices.length > 0) {
            dialogueChoices.classList.remove('screen-hidden');
            
            return new Promise((resolve) => {
                const handlers = [];
                
                const cleanupChoices = () => {
                    handlers.forEach(h => {
                        h.btn.removeEventListener('click', h.clickFn);
                        window.removeEventListener('keydown', h.keyFn);
                    });
                };
                
                const keyFn = (e) => {
                    const keyNum = parseInt(e.key, 10);
                    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= choices.length) {
                        e.preventDefault();
                        cleanupChoices();
                        resolve(keyNum - 1);
                    }
                };
                window.addEventListener('keydown', keyFn);
                this._boundListeners.push({ type: 'keydown', target: window, handler: keyFn, cleanup: () => window.removeEventListener('keydown', keyFn) });

                choices.forEach((choice, index) => {
                    const btn = document.createElement('button');
                    btn.className = 'dialogue-choice';
                    
                    const numSpan = document.createElement('span');
                    numSpan.className = 'choice-number';
                    numSpan.textContent = `[${index + 1}]`;
                    
                    const textNode = document.createTextNode(` ${choice.text}`);
                    
                    btn.appendChild(numSpan);
                    btn.appendChild(textNode);
                    
                    const clickFn = () => {
                        cleanupChoices();
                        resolve(index);
                    };
                    
                    btn.addEventListener('click', clickFn);
                    
                    dialogueChoices.appendChild(btn);
                    handlers.push({ btn, clickFn, keyFn });
                });
            });
        } else {
            dialogueContinue.classList.remove('screen-hidden');
            await this.waitForKey(' ');
            dialogueContinue.classList.add('screen-hidden');
        }
    }
    
    hideDialogue() {
        this._cancelTypewriters();
        this.elements.dialogueContainer.classList.add('screen-hidden');
        this.elements.dialogueText.innerHTML = '';
        this.elements.dialogueChoices.innerHTML = '';
        this.elements.dialogueContinue.classList.add('screen-hidden');
    }

    async showNarration(text, speed = 25) {
        this._cancelTypewriters();
        
        const { narrationContainer, narrationText, narrationContinue } = this.elements;
        
        narrationContainer.classList.remove('screen-hidden');
        narrationContinue.classList.add('screen-hidden');
        
        await this._typewrite(narrationText, text, speed);
        
        narrationContinue.classList.remove('screen-hidden');
        await this.waitForKey(' ');
        narrationContinue.classList.add('screen-hidden');
    }

    hideNarration() {
        this._cancelTypewriters();
        this.elements.narrationContainer.classList.add('screen-hidden');
        this.elements.narrationText.innerHTML = '';
    }

    showHUD() {
        this.elements.hud.classList.remove('screen-hidden');
    }

    hideHUD() {
        this.elements.hud.classList.add('screen-hidden');
    }

    updateMorale(value) {
        const clamped = Math.max(0, Math.min(100, value));
        this.elements.moraleFill.style.width = `${clamped}%`;
        this.elements.moraleValue.textContent = `${Math.round(clamped)}%`;
    }

    showDrownBar() {
        const drownBar = document.getElementById('drown-bar');
        if (drownBar) drownBar.classList.remove('screen-hidden');
    }

    hideDrownBar() {
        const drownBar = document.getElementById('drown-bar');
        if (drownBar) drownBar.classList.add('screen-hidden');
    }

    updateDrownBar(percent) {
        const clamped = Math.max(0, Math.min(100, percent));
        const fill = document.getElementById('drown-fill');
        const val = document.getElementById('drown-value');
        if (fill) fill.style.width = `${clamped}%`;
        if (val) val.textContent = `${Math.round(clamped)}% O2`;
    }

    showObjective(text) {
        this.elements.objectiveDisplay.classList.remove('screen-hidden');
        this.elements.objectiveText.textContent = text;
    }

    hideObjective() {
        this.elements.objectiveDisplay.classList.add('screen-hidden');
    }

    addInventoryItem({id, name}) {
        if (!this._inventory.has(id)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.textContent = name;
            itemDiv.dataset.id = id;
            
            this.elements.inventoryItems.appendChild(itemDiv);
            this._inventory.set(id, itemDiv);
            
            this.elements.inventoryDisplay.classList.remove('screen-hidden');
        }
    }

    removeInventoryItem(id) {
        if (this._inventory.has(id)) {
            const itemDiv = this._inventory.get(id);
            if (itemDiv && itemDiv.parentNode) {
                itemDiv.parentNode.removeChild(itemDiv);
            }
            this._inventory.delete(id);
            
            if (this._inventory.size === 0) {
                this.elements.inventoryDisplay.classList.add('screen-hidden');
            }
        }
    }

    showCrosshair() {
        this.elements.crosshair.classList.remove('screen-hidden');
    }

    hideCrosshair() {
        this.elements.crosshair.classList.add('screen-hidden');
    }

    highlightCrosshair(active) {
        if (active) {
            this.elements.crosshair.classList.add('active');
        } else {
            this.elements.crosshair.classList.remove('active');
        }
    }

    showInteractPrompt(label) {
        this.elements.interactLabel.textContent = label;
        this.elements.interactPrompt.classList.remove('screen-hidden');
    }

    hideInteractPrompt() {
        this.elements.interactPrompt.classList.add('screen-hidden');
    }

    async fadeToBlack(duration = 400) {
        const overlay = this.elements.fadeOverlay;
        overlay.style.transition = `opacity ${duration}ms ease`;
        overlay.classList.add('active');
        overlay.style.opacity = '1';
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    async fadeFromBlack(duration = 400) {
        const overlay = this.elements.fadeOverlay;
        overlay.style.transition = `opacity ${duration}ms ease`;
        overlay.classList.remove('active');
        overlay.style.opacity = '0';
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    async showTitle(title, subtitle, duration = 2000) {
        const { titleCard, titleMain, titleSub } = this.elements;
        titleMain.textContent = title;
        titleSub.textContent = subtitle;
        titleCard.classList.remove('screen-hidden');
        await new Promise(resolve => setTimeout(resolve, duration));
        titleCard.classList.add('screen-hidden');
    }

    showLetterbox() {
        this.elements.letterboxTop.classList.add('active');
        this.elements.letterboxBottom.classList.add('active');
    }

    hideLetterbox() {
        this.elements.letterboxTop.classList.remove('active');
        this.elements.letterboxBottom.classList.remove('active');
    }

    async showCutsceneBanner(text, duration = 3000) {
        this.showLetterbox();
        const { cutsceneContainer, cutsceneText } = this.elements;
        cutsceneContainer.classList.remove('screen-hidden');
        cutsceneText.innerHTML = '';
        await this._typewrite(cutsceneText, text, 30);
        await new Promise(resolve => setTimeout(resolve, duration));
        cutsceneContainer.classList.add('screen-hidden');
        this.hideLetterbox();
    }

    cleanup() {
        this._cancelTypewriters();
        this._boundListeners.forEach(({ cleanup }) => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        });
        this._boundListeners = [];
    }
}
