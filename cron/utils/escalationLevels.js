export const escalationLevels = [
    {
        level: 0,
        name: 'Created',
        timeToEscalate: 0,
        contacts: [
            {
                role: 'LM',
                name: 'Line Manager',
                phone: '916303457002',
            },
            // {
            //     role: 'LM1',
            //     name: 'Line Manager 1',
            //     phone: '917901678140',
            // },
            // {
            //     role: 'LM2',
            //     name: 'Line Manager 2',
            //     phone: '918332969755',
            // },
            // {
            //     role: 'LM3',
            //     name: 'Line Manager 3',
            //     phone: '919701253249',
            // },
            // {
            //     role: 'LM4',
            //     name: 'Line Manager 4',
            //     phone: '917780314837',
            // },
            // {
            //     role: 'LM5',
            //     name: 'Line Manager 5',
            //     phone: '919849569000',
            // },
        ],
    },
    {
        level: 1,
        name: 'Level 1',
        timeToEscalate: 15,
        contacts: [
            {
                role: 'LI',
                name: 'Line Inspector',
                phone: '916303457002',
            },
            // {
            //     role: 'SLI',
            //     name: 'Senior Line Inspector',
            //     phone: '916302631535',
            // },
            // {
            //     role: 'FM',
            //     name: 'Field Manager',
            //     phone: '919700393611',
            // },
            // {
            //     role: 'FMM',
            //     name: 'Field Manager',
            //     phone: '919849569000',
            // },
        ],
    },
    {
        level: 2,
        name: 'Level 2',
        timeToEscalate: 20,
        contacts: [
            {
                role: 'AE',
                name: 'Assistant Engineer',
                phone: '916303457002',
            },
        ],
    },
    {
        level: 3,
        name: 'Level 3',
        timeToEscalate: 30,
        contacts: [
            {
                role: 'ADE',
                name: 'Assistant Divisional Engineer',
                phone: '916303457002',
            },
        ],
    },
    {
        level: 4,
        name: 'Level 4',
        timeToEscalate: 45,
        contacts: [
            {
                role: 'DE',
                name: 'Divisional Engineer',
                phone: '916303457002',
            },
        ],
    },
    {
        level: 5,
        name: 'Level 5',
        timeToEscalate: 60,
        contacts: [
            {
                role: 'Management',
                name: 'Senior Management',
                phone: '916303457002',
            },
            // {
            //     role: 'Management',
            //     name: 'Senior Management',
            //     phone: '919849569000',
            // },
            // {
            //     role: 'Management',
            //     name: 'Senior Manaegment',
            //     phone: '917780314837',
            // },
        ],
    },
]; 