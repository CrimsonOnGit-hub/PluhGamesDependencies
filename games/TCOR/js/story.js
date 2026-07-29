export const STORY = {
  characters: {
    miles: { name: 'Miles', color: 'cyan' },
    jake: { name: 'Jake', color: 'green' },
    glory: { name: 'Glory', color: 'pink' },
    lily: { name: 'Lily', color: 'violet' },
    blue: { name: 'Blue', color: 'blue' },
    james: { name: 'James', color: 'orange' },
    crimson: { name: 'President Crimson', color: 'gold' },
    pa: { name: 'PA SYSTEM', color: 'red' },
    narrator: { name: '', color: 'white' },
  },
  acts: [
    {
      id: 1,
      title: 'The Rations Room',
      subtitle: '2021 — 2022 (Conditioning)',
      environment: 'rationsRoom',
      scenes: [
        // TRIAL 1
        {
          id: 'act1_explore1',
          type: 'exploration',
          objective: 'Trial 1/5: Examine your cell & listen to PA Speaker',
          completeWhen: 't1_done',
          interactables: [
            { id: 'table', label: 'Inspect Table', triggerScene: 'act1_inspect_table1' },
            { id: 'rations', label: 'Inspect Rations Block', triggerScene: 'act1_inspect_rations1' },
            { id: 'paSpeaker', label: 'Listen to PA Speaker', triggerScene: 'act1_q1' }
          ]
        },
        {
          id: 'act1_inspect_table1',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Cold metal table in the center of this stark, bright white padded cell. No windows.',
          nextScene: 'act1_explore1'
        },
        {
          id: 'act1_inspect_rations1',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Gray protein block. They cannot strike me under Crimson law, but they will starve me if I refuse.',
          nextScene: 'act1_explore1'
        },
        {
          id: 'act1_q1',
          type: 'dialogue',
          speaker: 'pa',
          text: 'SUBJECT NOBODII: WHAT IS YOUR NAME?'
        },
        {
          id: 'act1_choice1',
          type: 'choice',
          prompt: 'Trial 1 of 5 — Answer the PA System:',
          choices: [
            {
              text: 'Stay silent',
              isStarveChoice: true,
              cutscene: 'starve_rations_retract',
              moraleDelta: -5,
              consequence: 'Pneumatic tray retracts. No food. You can now hit the table or interact before time passes.',
              nextScene: 'act1_post_trial1'
            },
            {
              text: 'My name is Miles!',
              isStarveChoice: true,
              cutscene: 'starve_rations_retract',
              moraleDelta: 10,
              consequence: 'Pneumatic tray retracts. Keeping your name cost you food.',
              nextScene: 'act1_post_trial1'
            },
            {
              text: 'Nobodii...',
              isStarveChoice: false,
              moraleDelta: -10,
              consequence: 'Pneumatic tray stays. Eat the gray rations block before time passes.',
              nextScene: 'act1_post_trial1'
            }
          ]
        },
        {
          id: 'act1_post_trial1',
          type: 'exploration',
          objective: 'Trial 1 Complete: Eat rations or hit table, then talk to PA Speaker to advance time',
          completeWhen: 't1_post_done',
          interactables: [
            { id: 'table', label: 'Hit Table in Frustration', triggerScene: 'act1_hit_table1' },
            { id: 'rations', label: 'Eat Gray Rations', triggerScene: 'act1_eat_rations1' },
            { id: 'paSpeaker', label: 'Advance Time (Press ENTER)', triggerScene: 'act1_time1' }
          ]
        },
        {
          id: 'act1_hit_table1',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'hit',
          screenEffect: 'shake',
          text: '*SLAM!* You hit the freezing metal table with your fist. The echo bounces off white padded walls.',
          nextScene: 'act1_post_trial1'
        },
        {
          id: 'act1_eat_rations1',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'eat',
          text: '*MUNCH...* You chew the cold, damp protein paste. It tastes like dust, but keeps your stomach alive.',
          nextScene: 'act1_post_trial1'
        },
        {
          id: 'act1_time1',
          type: 'narration',
          soundEffect: 'hiss',
          text: '*** 1 WEEK LATER ***',
          nextScene: 'act1_explore2'
        },

        // TRIAL 2
        {
          id: 'act1_explore2',
          type: 'exploration',
          objective: 'Trial 2/5: Examine cell & listen to PA Speaker',
          completeWhen: 't2_done',
          interactables: [
            { id: 'table', label: 'Inspect Table', triggerScene: 'act1_inspect_table2' },
            { id: 'rations', label: 'Inspect Rations Block', triggerScene: 'act1_inspect_rations2' },
            { id: 'paSpeaker', label: 'Listen to PA Speaker', triggerScene: 'act1_q2' }
          ]
        },
        {
          id: 'act1_inspect_table2',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The table is still freezing to the touch. Another cycle begins.',
          nextScene: 'act1_explore2'
        },
        {
          id: 'act1_inspect_rations2',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The gray block sits on the plate. My stomach twists.',
          nextScene: 'act1_explore2'
        },
        {
          id: 'act1_q2',
          type: 'dialogue',
          speaker: 'pa',
          text: 'SUBJECT NOBODII: WHAT IS YOUR NAME?'
        },
        {
          id: 'act1_choice2',
          type: 'choice',
          prompt: 'Trial 2 of 5 — Answer the PA System:',
          choices: [
            {
              text: 'Stay silent',
              isStarveChoice: true,
              moraleDelta: -5,
              consequence: 'Plate retracts. Stomach pains continue.',
              nextScene: 'act1_post_trial2'
            },
            {
              text: 'Miles!',
              isStarveChoice: true,
              moraleDelta: 10,
              consequence: 'Plate retracts. You hold onto your name.',
              nextScene: 'act1_post_trial2'
            },
            {
              text: 'Nobodii...',
              isStarveChoice: false,
              moraleDelta: -10,
              consequence: 'Plate stays. You swallow the tasteless paste.',
              nextScene: 'act1_post_trial2'
            }
          ]
        },
        {
          id: 'act1_post_trial2',
          type: 'exploration',
          objective: 'Trial 2 Complete: Eat or hit table, then advance time',
          completeWhen: 't2_post_done',
          interactables: [
            { id: 'table', label: 'Hit Table in Frustration', triggerScene: 'act1_hit_table2' },
            { id: 'rations', label: 'Eat Gray Rations', triggerScene: 'act1_eat_rations2' },
            { id: 'paSpeaker', label: 'Advance Time (Press ENTER)', triggerScene: 'act1_time2' }
          ]
        },
        {
          id: 'act1_hit_table2',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'hit',
          screenEffect: 'shake',
          text: '*BANG!* Your fist strikes the table. Your knuckles ache.',
          nextScene: 'act1_post_trial2'
        },
        {
          id: 'act1_eat_rations2',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'eat',
          text: '*MUNCH...* You force down the protein block.',
          nextScene: 'act1_post_trial2'
        },
        {
          id: 'act1_time2',
          type: 'narration',
          soundEffect: 'hiss',
          text: '*** 3 MONTHS LATER ***',
          nextScene: 'act1_explore3'
        },

        // TRIAL 3 — THE BREAKING POINT
        {
          id: 'act1_explore3',
          type: 'exploration',
          objective: 'Trial 3/5: Examine cell & listen to PA Speaker',
          completeWhen: 't3_done',
          interactables: [
            { id: 'table', label: 'Inspect Table', triggerScene: 'act1_inspect_table3' },
            { id: 'rations', label: 'Inspect Rations Block', triggerScene: 'act1_inspect_rations3' },
            { id: 'paSpeaker', label: 'Listen to PA Speaker', triggerScene: 'act1_q3' }
          ]
        },
        {
          id: 'act1_inspect_table3',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Scratch marks on the metal table... I feel drained. Something inside me is cracking.',
          nextScene: 'act1_explore3'
        },
        {
          id: 'act1_inspect_rations3',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The harsh fluorescent light hums. My eyes feel heavy.',
          nextScene: 'act1_explore3'
        },
        {
          id: 'act1_q3',
          type: 'dialogue',
          speaker: 'pa',
          text: 'SUBJECT NOBODII: WHAT IS YOUR NAME?'
        },
        {
          id: 'act1_choice3',
          type: 'choice',
          prompt: 'Trial 3 of 5 — Answer the PA System:',
          choices: [
            {
              text: 'Stay silent...',
              isStarveChoice: true,
              moraleDelta: -15,
              consequence: 'Plate retracts. You stare blankly at the floor.',
              nextScene: 'act1_post_trial3'
            },
            {
              text: 'Miles...',
              isStarveChoice: true,
              moraleDelta: -15,
              consequence: 'Plate retracts. Voice is a tired whisper.',
              nextScene: 'act1_post_trial3'
            },
            {
              text: 'Nobodii...',
              isStarveChoice: false,
              moraleDelta: -20,
              consequence: 'Plate stays. Hollow feeling inside.',
              nextScene: 'act1_post_trial3'
            }
          ]
        },
        {
          id: 'act1_post_trial3',
          type: 'exploration',
          objective: 'Trial 3 Complete: Eat or hit table, then advance time',
          completeWhen: 't3_post_done',
          interactables: [
            { id: 'table', label: 'Weakly Hit Table', triggerScene: 'act1_hit_table3' },
            { id: 'rations', label: 'Eat Gray Rations', triggerScene: 'act1_eat_rations3' },
            { id: 'paSpeaker', label: 'Advance Time (Press ENTER)', triggerScene: 'act1_time3' }
          ]
        },
        {
          id: 'act1_hit_table3',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'hit',
          text: 'A weak thud on the table. You don\'t have the strength to slam it anymore.',
          nextScene: 'act1_post_trial3'
        },
        {
          id: 'act1_eat_rations3',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'eat',
          text: 'You swallow the paste without tasting it.',
          nextScene: 'act1_post_trial3'
        },
        {
          id: 'act1_time3',
          type: 'narration',
          soundEffect: 'hiss',
          text: '*** 6 MONTHS LATER (YEAR 2022) — YOU ARE COMPLETELY DRAINED AND DEPRESSED ***',
          nextScene: 'act1_explore4'
        },

        // TRIAL 4 — DEPRESSED & APATHETIC MILES
        {
          id: 'act1_explore4',
          type: 'exploration',
          objective: 'Trial 4/5: Stare at the room... you don\'t care anymore',
          completeWhen: 't4_done',
          interactables: [
            { id: 'table', label: 'Stare at Floor', triggerScene: 'act1_inspect_table4' },
            { id: 'rations', label: 'Ignore Rations', triggerScene: 'act1_inspect_rations4' },
            { id: 'paSpeaker', label: 'Stare at Speaker', triggerScene: 'act1_q4' }
          ]
        },
        {
          id: 'act1_inspect_table4',
          type: 'dialogue',
          speaker: 'miles',
          text: 'I stare blankly at the floor. It doesn\'t matter. Nothing matters.',
          nextScene: 'act1_explore4'
        },
        {
          id: 'act1_inspect_rations4',
          type: 'dialogue',
          speaker: 'miles',
          text: 'A block of protein... food or no food, I don\'t care about myself anymore.',
          nextScene: 'act1_explore4'
        },
        {
          id: 'act1_q4',
          type: 'dialogue',
          speaker: 'pa',
          text: 'SUBJECT NOBODII: WHAT IS YOUR NAME?'
        },
        {
          id: 'act1_choice4',
          type: 'choice',
          prompt: 'Trial 4 of 5 — Apathetic Response:',
          choices: [
            {
              text: 'Whatever... (Silence)',
              isStarveChoice: true,
              moraleDelta: -10,
              consequence: 'Plate retracts. You don\'t even flinch.',
              nextScene: 'act1_post_trial4'
            },
            {
              text: 'Does it even matter?',
              isStarveChoice: true,
              moraleDelta: -10,
              consequence: 'Plate retracts. The voice on the PA system is just background noise.',
              nextScene: 'act1_post_trial4'
            },
            {
              text: 'Nobodii... who cares.',
              isStarveChoice: false,
              moraleDelta: -15,
              consequence: 'Plate stays. You eat like a machine. Empty inside.',
              nextScene: 'act1_post_trial4'
            }
          ]
        },
        {
          id: 'act1_post_trial4',
          type: 'exploration',
          objective: 'Trial 4 Complete: Eat or hit table, then advance time',
          completeWhen: 't4_post_done',
          interactables: [
            { id: 'table', label: 'Rest Head on Table', triggerScene: 'act1_hit_table4' },
            { id: 'rations', label: 'Mechanically Eat Rations', triggerScene: 'act1_eat_rations4' },
            { id: 'paSpeaker', label: 'Advance Time (Press ENTER)', triggerScene: 'act1_time4' }
          ]
        },
        {
          id: 'act1_hit_table4',
          type: 'dialogue',
          speaker: 'miles',
          text: 'You rest your head on the cold table. The metal is dull.',
          nextScene: 'act1_post_trial4'
        },
        {
          id: 'act1_eat_rations4',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'eat',
          text: 'You chew rhythmically, empty of thought.',
          nextScene: 'act1_post_trial4'
        },
        {
          id: 'act1_time4',
          type: 'narration',
          soundEffect: 'hiss',
          text: '*** 4 MONTHS LATER — HOLLOW AND NUMB ***',
          nextScene: 'act1_explore5'
        },

        // TRIAL 5 — NUMB & BROKEN
        {
          id: 'act1_explore5',
          type: 'exploration',
          objective: 'Trial 5/5: Final Trial — Stare into the void',
          completeWhen: 't5_done',
          interactables: [
            { id: 'table', label: 'Stare at Walls', triggerScene: 'act1_inspect_table5' },
            { id: 'rations', label: 'Look at Hands', triggerScene: 'act1_inspect_rations5' },
            { id: 'paSpeaker', label: 'Hear PA Voice', triggerScene: 'act1_q5' }
          ]
        },
        {
          id: 'act1_inspect_table5',
          type: 'dialogue',
          speaker: 'miles',
          text: 'I look at my thin, pale hands. I barely recognize who I am.',
          nextScene: 'act1_explore5'
        },
        {
          id: 'act1_inspect_rations5',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The white walls press in. I am completely numb.',
          nextScene: 'act1_explore5'
        },
        {
          id: 'act1_q5',
          type: 'dialogue',
          speaker: 'pa',
          text: 'FINAL TRIAL 5/5: SUBJECT NOBODII: WHAT IS YOUR NAME?'
        },
        {
          id: 'act1_choice5',
          type: 'choice',
          prompt: 'Final Trial 5 of 5 — Numb Response:',
          choices: [
            {
              text: '...',
              isStarveChoice: true,
              moraleDelta: -10,
              consequence: 'Plate retracts. 5 trials completed.',
              nextScene: 'act1_time_final'
            },
            {
              text: 'I don\'t care anymore.',
              isStarveChoice: true,
              moraleDelta: -10,
              consequence: 'Plate retracts. 5 trials completed.',
              nextScene: 'act1_time_final'
            },
            {
              text: 'Nobodii...',
              isStarveChoice: false,
              moraleDelta: -15,
              consequence: 'Plate stays. 5 trials completed.',
              nextScene: 'act1_time_final'
            }
          ]
        },
        {
          id: 'act1_time_final',
          type: 'narration',
          soundEffect: 'hiss',
          text: '*** TRANSFERRED TO RESIDENTIAL SECTOR (EARLY 2023) ***',
          nextScene: null
        }
      ]
    },
    {
      id: 2,
      title: 'The Great Split',
      subtitle: 'July 2023',
      environment: 'courtroom',
      scenes: [
        {
          id: 'act2_courtroom',
          type: 'dialogue',
          speaker: 'crimson',
          cutscene: 'courtroom_rage',
          text: 'If you want your stupid ass bunny shirts mandatory, then split off of Crimson Island and make your own country!'
        },
        {
          id: 'act2_split_event',
          type: 'dialogue',
          speaker: 'pa',
          text: 'WARNING: TECTONIC THRUSTERS ENGAGED. SPLITTING FROM MAINLAND.',
          screenEffect: 'shake',
          nextScene: null
        }
      ]
    },
    {
      id: 3,
      title: 'Tragedy & The Anchor',
      subtitle: '2023 — 2025 (Chronological Timeline)',
      environment: 'residentialQuarters_glory',
      scenes: [
        {
          id: 'act3_glory_intro',
          type: 'exploration',
          environment: 'residentialQuarters_glory',
          cutscene: 'glory_arrival',
          objective: 'Early 2023: Walk up to Glory in the sector',
          interactables: [
            { id: 'glory', label: 'Talk to Glory', triggerScene: 'act3_glory_talk' }
          ]
        },
        {
          id: 'act3_glory_talk',
          type: 'dialogue',
          speaker: 'glory',
          text: 'Miles... in this cold, awful place, staying close to you is the only thing keeping my heart alive.',
          nextScene: 'act3_jake_arrives_stage'
        },
        {
          id: 'act3_jake_arrives_stage',
          type: 'narration',
          environment: 'residentialQuarters_glory_jake',
          cutscene: 'jake_arrival',
          text: 'July 27, 2023. A new boy named Jake moves into the sector. He becomes your closest friend.',
          nextScene: 'act3_jake_explore'
        },
        {
          id: 'act3_jake_explore',
          type: 'exploration',
          environment: 'residentialQuarters_glory_jake',
          objective: 'Talk to Jake in the sector',
          interactables: [
            { id: 'jake', label: 'Talk to Jake', triggerScene: 'act3_jake_talk' },
            { id: 'glory', label: 'Talk to Glory', triggerScene: 'act3_glory_talk2' }
          ]
        },
        {
          id: 'act3_glory_talk2',
          type: 'dialogue',
          speaker: 'glory',
          text: 'I\'m glad Jake is here with us, Miles. We need all the hope we can get.',
          nextScene: 'act3_jake_explore'
        },
        {
          id: 'act3_jake_talk',
          type: 'dialogue',
          speaker: 'jake',
          text: 'We\'ll survive this together, Miles. Just gotta keep our spirits high.',
          nextScene: 'act3_jake_drown_stage'
        },
        {
          id: 'act3_jake_drown_stage',
          type: 'narration',
          text: 'November 12, 2023. The psychological pressure breaks Jake. He stares out at the ocean...',
          nextScene: 'act3_jake_drown_talk'
        },
        {
          id: 'act3_jake_drown_talk',
          type: 'dialogue',
          speaker: 'jake',
          text: 'Look, Miles... I think we can just swim to Crimson Island. I\'m diving in now!',
          nextScene: 'act3_jake_drown_event'
        },
        {
          id: 'act3_jake_drown_event',
          type: 'dialogue',
          speaker: 'miles',
          environment: 'residentialQuarters_glory',
          cutscene: 'jake_drown',
          text: 'JAKE NO! The ocean current swallowed him... My best friend is gone.',
          moraleDelta: -20,
          nextScene: 'act3_glory_escape_stage'
        },
        {
          id: 'act3_glory_escape_stage',
          type: 'narration',
          text: 'December 13, 2023. One month later. The weight of the cage breaks Glory\'s resolve.',
          nextScene: 'act3_glory_escape_talk'
        },
        {
          id: 'act3_glory_escape_talk',
          type: 'dialogue',
          speaker: 'glory',
          text: 'Miles, I may not make it back, but I\'m going to try and escape on a cargo ship tonight.',
          nextScene: 'act3_glory_execution_event'
        },
        {
          id: 'act3_glory_execution_event',
          type: 'dialogue',
          speaker: 'miles',
          environment: 'residentialQuarters_empty',
          cutscene: 'glory_execution',
          text: 'The guards caught her... they executed Glory right in front of my eyes. I am hollow.',
          screenEffect: 'flash_red',
          moraleDelta: -25,
          nextScene: 'act3_lily_arrives_stage'
        },
        {
          id: 'act3_lily_arrives_stage',
          type: 'narration',
          environment: 'residentialQuarters_lily',
          cutscene: 'lily_arrival',
          text: 'Early 2024. A new resident named Lily moves in. She has an uncanny, identical resemblance to Glory.',
          nextScene: 'act3_lily_explore'
        },
        {
          id: 'act3_lily_explore',
          type: 'exploration',
          environment: 'residentialQuarters_lily',
          objective: 'Talk to Lily in the sector',
          interactables: [
            { id: 'lily', label: 'Talk to Lily', triggerScene: 'act3_lily_talk' }
          ]
        },
        {
          id: 'act3_lily_talk',
          type: 'dialogue',
          speaker: 'lily',
          text: 'Miles... I know I look like her, but we have to keep a hard line as friends to protect ourselves.',
          nextScene: 'act3_james_arrives_stage'
        },
        {
          id: 'act3_james_arrives_stage',
          type: 'narration',
          environment: 'residentialQuarters_lily_james',
          cutscene: 'james_arrival',
          text: '2025. James arrives. A nationalist warden who aggressively patrols camera blind spots to watch you.',
          nextScene: 'act3_james_explore'
        },
        {
          id: 'act3_james_explore',
          type: 'exploration',
          environment: 'residentialQuarters_lily_james',
          objective: 'Talk to James in the sector',
          interactables: [
            { id: 'james', label: 'Talk to James', triggerScene: 'act3_james_talk' },
            { id: 'lily', label: 'Talk to Lily', triggerScene: 'act3_lily_talk2' }
          ]
        },
        {
          id: 'act3_lily_talk2',
          type: 'dialogue',
          speaker: 'lily',
          text: 'Be careful around James, Miles. He exploits the camera blind spots to spy on us.',
          nextScene: 'act3_james_explore'
        },
        {
          id: 'act3_james_talk',
          type: 'dialogue',
          speaker: 'james',
          text: 'I see you, Miles! Restrictia is supreme! Don\'t try anything non-compliant in these blind spots!',
          nextScene: 'act3_blue_arrives_stage'
        },
        {
          id: 'act3_blue_arrives_stage',
          type: 'narration',
          environment: 'residentialQuarters_full',
          cutscene: 'blue_arrival',
          text: 'Then came Blue. A guy with a core of solid iron who never cracks under pressure. Your ride-or-die anchor.',
          nextScene: 'act3_blue_explore'
        },
        {
          id: 'act3_blue_explore',
          type: 'exploration',
          environment: 'residentialQuarters_full',
          objective: 'Talk to Blue',
          interactables: [
            { id: 'blue', label: 'Talk to Blue', triggerScene: 'act3_blue_talk' }
          ]
        },
        {
          id: 'act3_blue_talk',
          type: 'dialogue',
          speaker: 'blue',
          text: 'Stay solid, Miles. Don\'t let the Council get inside your head. I\'m right here with you.',
          moraleDelta: 15,
          nextScene: null
        }
      ]
    },
    {
      id: 4,
      title: 'The Spark of Rebellion',
      subtitle: '2026',
      environment: 'residentialQuarters_full',
      scenes: [
        {
          id: 'act4_confront',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Guys, I\'m going to do something I\'ve never done before.'
        },
        {
          id: 'act4_lily_gasp',
          type: 'dialogue',
          speaker: 'lily',
          text: 'Miles...'
        },
        {
          id: 'act4_tear_shirt',
          type: 'dialogue',
          speaker: 'pa',
          cutscene: 'shirt_tear',
          text: 'WAAAAAAAH! WAAAAAAAH! SUBJECT HAS REMOVED THE MANDATORY BUNNY SHIRT!',
          screenEffect: 'shake',
          moraleDelta: 30
        },
        {
          id: 'act4_jail_explore',
          type: 'exploration',
          environment: 'interrogationBlock',
          objective: 'Escape the cell using the bobby pin & search the terminal',
          completeWhen: 'escaped_cell',
          addItem: { id: 'bobby_pin', name: 'Bobby Pin' },
          interactables: [
            { id: 'cuffs', label: 'Pick Lock on CyberCuffs', triggerScene: 'act4_pick_lock' },
            { id: 'guard', label: 'Take Down Guard & Steal Gun', triggerScene: 'act4_kill_guard' },
            { id: 'terminal', label: 'Delete Security Footage', triggerScene: 'act4_terminal_delete' }
          ]
        },
        {
          id: 'act4_pick_lock',
          type: 'dialogue',
          speaker: 'miles',
          text: '*CLICK!* Bobby pin jammed into the manual lock cylinder! Magnetic cuffs shattered!',
          setFlag: 'cuffs_unlocked',
          nextScene: 'act4_jail_explore'
        },
        {
          id: 'act4_kill_guard',
          type: 'dialogue',
          speaker: 'miles',
          soundEffect: 'shot',
          text: 'Lunged across the room! Wrenched the firearm from his holster! Guard went to sleep permanently.',
          addItem: { id: 'guard_gun', name: 'Guard Gun' },
          nextScene: 'act4_jail_explore'
        },
        {
          id: 'act4_terminal_delete',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Deleted the security footage of tearing the shirt before it could upload to the mainframe!',
          setFlag: 'escaped_cell',
          nextScene: null
        }
      ]
    },
    {
      id: 5,
      title: 'Flight from Restrictia',
      subtitle: '2026',
      environment: 'residentialQuarters_full',
      scenes: [
        {
          id: 'act5_burst_in',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Lily, I escaped and killed one of the guards and took their gun and deleted the footage!'
        },
        {
          id: 'act5_lily_pleads',
          type: 'dialogue',
          speaker: 'lily',
          text: 'Please don\'t end up like Glory and Jake... please...'
        },
        {
          id: 'act5_blue_support',
          type: 'dialogue',
          speaker: 'blue',
          text: 'Man, I\'m on your side.'
        },
        {
          id: 'act5_james_snitch',
          type: 'dialogue',
          speaker: 'james',
          text: 'IM REPORTING YOU!'
        },
        {
          id: 'act5_shoot_james',
          type: 'dialogue',
          speaker: 'miles',
          cutscene: 'shoot_james',
          soundEffect: 'shot',
          text: '*BANG!* Shot James straight in the foot! Wrapped heavy military bandage & fed pain pill.',
          screenEffect: 'flash_white'
        },
        {
          id: 'act5_james_redeemed',
          type: 'dialogue',
          speaker: 'james',
          text: 'I\'m sorry! I was psychologically manipulated into thinking nationalism was good... I\'m on your side now!'
        },
        {
          id: 'act5_james_doubt',
          type: 'dialogue',
          speaker: 'james',
          text: 'It\'s literally battery powered, dumbass. There\'s a negative wire, a positive wire, and a ground wire. MILES, YOU IDIOT, A TRIPLE-A BATTERY ISN\'T GONNA—'
        },
        {
          id: 'act5_thruster_test',
          type: 'dialogue',
          speaker: 'miles',
          text: '*WHIRRRR!* Tapped AAA battery on leads. Modular thruster turbine spun up!'
        },
        {
          id: 'act5_james_math',
          type: 'dialogue',
          speaker: 'james',
          text: 'Miles, I see it works. But you will need 58,000 Triple-A batteries to power all 20. You need a lot.'
        },
        {
          id: 'act5_battery_cube',
          type: 'dialogue',
          speaker: 'miles',
          text: 'That\'s why I got this thing! Emergency battery packed with 58,000 AAA cells!'
        },
        {
          id: 'act5_scavenge_raft',
          type: 'exploration',
          objective: 'Assemble the Rocket Pallet in Miles\'s bedroom & launch down the 60° Resident Emergency Chute',
          completeWhen: 'raft_built',
          interactables: [
            { id: 'coolRocksBox', label: 'Open "My cool rocks" Box (Get Screwdriver & Metal Scraps)', triggerScene: 'act5_get_pallet' },
            { id: 'oceanWindow', label: 'Attach Tectonic Thrusters', triggerScene: 'act5_get_thrusters' },
            { id: 'emergencyChute', label: 'Connect 58,000 Battery & Launch down 60° Emergency Chute', triggerScene: 'act5_get_battery' }
          ]
        },
        {
          id: 'act5_get_pallet',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Opened the cardboard box marked "My cool rocks"! Used the sand/concrete screwdriver to assemble metal scraps onto the wood pallet!',
          addItem: { id: 'pallet', name: 'Iron-Plated Pallet' },
          nextScene: 'act5_scavenge_raft'
        },
        {
          id: 'act5_get_thrusters',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Used the sand-screwdriver to unbolt 20 modular thrusters underwater!',
          addItem: { id: 'thrusters', name: 'Modular Thrusters' },
          nextScene: 'act5_scavenge_raft'
        },
        {
          id: 'act5_get_battery',
          type: 'dialogue',
          speaker: 'miles',
          text: 'Connected the 58,000-cell battery matrix! Rocket sled is mounted over the 60-degree Resident Emergency Chute!',
          addItem: { id: 'battery', name: '58,000 Battery Cube' },
          setFlag: 'raft_built',
          nextScene: 'act5_chute_launch'
        },
        {
          id: 'act5_chute_launch',
          type: 'dialogue',
          speaker: 'pa',
          cutscene: 'chute_launch',
          soundEffect: 'siren',
          text: 'ALL GUARDS! SUBJECT NOBODII, LILY, BLUE, AND JAMES ARE LAUNCHING DOWN THE 60° RESIDENT EMERGENCY CHUTE! EXECUTE THEM!',
          screenEffect: 'shake'
        },
        {
          id: 'act5_ocean_chase',
          type: 'dialogue',
          speaker: 'blue',
          cutscene: 'beach_crash',
          text: 'NOW, MILES! SLAM THE GROUND WIRES TOGETHER!',
          screenEffect: 'shake',
          nextScene: null
        }
      ]
    },
    {
      id: 6,
      title: 'Shores of Freedom',
      subtitle: '2026',
      environment: 'beach',
      scenes: [
        {
          id: 'act6_beach_explore',
          type: 'exploration',
          objective: 'Talk to President Crimson & team on the shore',
          completeWhen: 'beach_explored',
          interactables: [
            { id: 'statue', label: 'Talk to President Crimson', triggerScene: 'act6_talk_crimson' },
            { id: 'crater', label: 'Listen to James', triggerScene: 'act6_inspect_crater' }
          ]
        },
        {
          id: 'act6_inspect_crater',
          type: 'dialogue',
          speaker: 'james',
          text: 'MY NAME IS ANDERDINGUSSSSSSSSS!',
          nextScene: 'act6_beach_explore'
        },
        {
          id: 'act6_talk_crimson',
          type: 'dialogue',
          speaker: 'crimson',
          text: 'Miles? Your alive! Oh my gosh, I got the signal that you were coming on a makeshift raft. You brought three friends with you? They are handsome. And Lily is beautiful.',
          nextScene: 'act6_miles_war'
        },
        {
          id: 'act6_miles_war',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The treaty is burnt, Crimson. We\'re going to war.',
          setFlag: 'beach_explored',
          nextScene: null
        }
      ]
    },
    {
      id: 7,
      title: 'The Enshrinement',
      subtitle: '2027 — Epilogue',
      environment: 'museum',
      scenes: [
        {
          id: 'epi_museum_explore',
          type: 'exploration',
          objective: 'Explore the Old Restrictia Museum hall and inspect the exhibits',
          completeWhen: 'museum_done',
          interactables: [
            { id: 'podium', label: 'Inspect Bronze Hero Statue', triggerScene: 'act7_hero_statue' },
            { id: 'displayCase', label: 'Examine Sand/Concrete Screwdriver', triggerScene: 'act7_screwdriver' }
          ]
        },
        {
          id: 'epi_hero_statue',
          type: 'dialogue',
          speaker: 'crimson',
          text: 'A toast to Miles, Lily, James, and Blue! One day, Miles gave me a transmitter... and today, their bronze monument stands in our capital!',
          nextScene: 'epi_museum_explore'
        },
        {
          id: 'epi_screwdriver',
          type: 'dialogue',
          speaker: 'miles',
          text: 'The Council thought they could cage us like rabbits. But they forgot what happens when a Nobody strikes back.',
          setFlag: 'museum_done',
          nextScene: null
        }
      ]
    }
  ]
};
