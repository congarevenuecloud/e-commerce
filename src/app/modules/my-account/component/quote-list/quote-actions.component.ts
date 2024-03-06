import * as _ from 'lodash';

export class QuoteActions{
    constructor(){}
    public actionConfiguration = {
        'Draft': {
            color: 'secondary',
            actions: [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Checkout'
                },
                {
                    label: 'Send'
                }
            ],
            allowDelete : true
        },
        'Approval Required': {
            color: 'warning',
            actions: [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Send'
                },
                {
                    label: 'Submit for Approval'
                }
            ],
            allowDelete: true
        },
        'In Review': {
            color: 'warning',
            actions: [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Send'
                }
            ],
            allowDelete: false
        },
        'Approved': {
            color: 'success',
            actions: [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Send'
                },
                {
                    label: 'Send for eSignature'
                }
            ],
            allowDelete: true
        },
        'Accepted': {
            color: 'success',
            actions: [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Create Order'
                },
                {
                    label: 'Send'
                }
            ],
            allowDelete: true
        },
        'Presented' : {
            color : 'success',
            actions : [
                {
                    label: 'Download PDF'
                },
                {
                    label: 'Create Order'
                },
                {
                    label: 'Send'
                }
            ],
            allowDelete: true
        }
    };
}