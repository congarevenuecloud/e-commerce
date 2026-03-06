import { Component, OnInit, ViewChild, TemplateRef, NgZone, ChangeDetectorRef, OnDestroy, ViewEncapsulation, ElementRef, Inject, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { TranslateService, } from '@ngx-translate/core';
import { filter, map, take, switchMap } from 'rxjs/operators';
import { get, set, first, map as _map, isEmpty, join, split, trim, isNil } from 'lodash';
import { Observable, of, BehaviorSubject, Subscription, combineLatest, forkJoin } from 'rxjs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { FilterOperator } from '@congarevenuecloud/core';
import {
  UserService, QuoteService, Quote, Order, OrderService, AttachmentService,
  AttachmentDetails, ProductInformationService, ItemGroup, EmailService, LineItemService, EmailRequestPayload,
  CartService, Cart, DateFormat, FieldFilter, ContactService, CollaborationRequestService, CollaborationRequest, CollaborationAccessType, CollaborationAuthenticationType
} from '@congarevenuecloud/ecommerce';
import { ExceptionService, LookupOptions, ToasterPosition, FileOutput, AddCommentsConfig, ViewCommentsConfig } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-quote-details',
  templateUrl: './quote-details.component.html',
  styleUrls: ['./quote-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QuoteDetailsComponent implements OnInit, OnDestroy {

  quoteLineItems$: BehaviorSubject<Array<ItemGroup>> = new BehaviorSubject<Array<ItemGroup>>(null);
  attachmentList$: BehaviorSubject<Array<AttachmentDetails>> = new BehaviorSubject<Array<AttachmentDetails>>(null);
  order$: Observable<Order>;
  quote

  @ViewChild('attachmentSection') attachmentSection: ElementRef;
  @ViewChild('fileInput') fileInput: ElementRef;

  intimationModal: BsModalRef;

  supportedFileTypes: string;

  editLoader = false;

  acceptLoader = false;

  rejectLoader = false;

  attachmentsLoader = false;

  finalizeLoader = false;

  quoteGenerated: boolean = false;

  attachemntSubscription: Subscription;

  quoteSubscription: Subscription[] = [];

  showPresentTemplate = false;

  showReqChangesModal = false;

  showViewCommentsComponent = true;

  viewCommentsConfig: ViewCommentsConfig = {
    modalOptions: { 'class': 'modal-lg', 'backdrop': 'static', 'keyboard': true },
    showTypeFilter: true,
    pageSize: 10,
    enablePagination: true,
    dateFormat: 'ShortDateTimePattern'
  };

  requestChangesConfig: AddCommentsConfig;

  addCommentsConfig: AddCommentsConfig = {
    showCommentType: true,
  }

  quoteStatusSteps: Array<string> = [
    'STATUS.DRAFT',
    'STATUS.APPROVED',
    'STATUS.GENERATED',
    'STATUS.PRESENTED',
    'STATUS.ACCEPTED',
  ];

  quoteStatusMap: Record<string, { Key: string; DisplayText: string }> = {
    Draft: { Key: 'Draft', DisplayText: 'STATUS.DRAFT' },
    'Approval Required': {
      Key: 'Approval Required',
      DisplayText: 'STATUS.APPROVAL_REQUIRED',
    },
    'In Review': { Key: 'In Review', DisplayText: 'STATUS.IN_REVIEW' },
    Approved: { Key: 'Approved', DisplayText: 'STATUS.APPROVED' },
    Generated: { Key: 'Generated', DisplayText: 'STATUS.GENERATED' },
    Presented: { Key: 'Presented', DisplayText: 'STATUS.PRESENTED' },
    Accepted: { Key: 'Accepted', DisplayText: 'STATUS.ACCEPTED' },
    Denied: { Key: 'Denied', DisplayText: 'STATUS.DENIED' },
  };

  isLoggedIn: boolean;
  collaborationRequest: CollaborationRequest = null;
  isRecordOwner: boolean = false;
  currentUserId: string;
  isAnonymous: boolean = false;
  canManageLineItems: boolean = true;
  canEditQuoteFields: boolean = true;
  canShowCollaborationActions: boolean = true;

  @ViewChild('intimationTemplate') intimationTemplate: TemplateRef<any>;

  lookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Id', 'Name', 'Email']
  };

  isPrivate: boolean = false;
  maxFileSizeLimit = 29360128;
  cartRecord: Cart = new Cart();
  // Flag used to toggle the content visibility when the list of fields exceeds two rows of the summary with show more or show less icon
  isExpanded: boolean = false;
  quoteStatusLabelMap: Record<string, string> = {};
  quoteStatusStepsLabels: Array<string> = [];
  acceptQuoteEmailTemplateName = 'DC Accept Quote Default email template';
  rejectQuoteEmailTemplateName = 'DC Reject Quote Default email template';

  constructor(private activatedRoute: ActivatedRoute,
    private quoteService: QuoteService,
    private exceptionService: ExceptionService,
    private modalService: BsModalService,
    private orderService: OrderService,
    private emailService: EmailService,
    private attachmentService: AttachmentService,
    private productInformationService: ProductInformationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private userService: UserService,
    private router: Router,
    private cartService: CartService,
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2,
    private translateService: TranslateService,
    private collaborationService: CollaborationRequestService,
    private contactService: ContactService
  ) { }

  ngOnInit() {
    this.initializeTranslationsComments();
    this.getQuote();
    this.quoteSubscription.push(this.userService.isLoggedIn().pipe(switchMap((value: boolean) => {
      this.isLoggedIn = value;
      if (this.isLoggedIn)
        return this.attachmentService.getSupportedAttachmentType();
      else
        return of(null);
    }), take(1)
    ).subscribe(data => {
      this.supportedFileTypes = join(_map(split(data, ','), (item) => trim(item)), ', ');
    }));
    this.quoteSubscription.push(
      this.translateService
        .stream(this.quoteStatusSteps)
        .subscribe((translations) => {
          this.quoteStatusStepsLabels = this.quoteStatusSteps.map(
            (key) => translations[key]
          );
        })
    );
    this.translateQuoteStatusLabels(this.quoteStatusMap);
  }

  private initializeTranslationsComments(): void {
    const commentTranslationKeys = [
      'COMMENTS.SEND_REQUEST',
      'COMMENTS.ENTER_COMMENTS',
      'COMMON.CANCEL'
    ];

    this.quoteSubscription.push(
      this.translateService.stream(commentTranslationKeys).subscribe(translations => {
        this.requestChangesConfig = {
          modalOptions: { 'class': 'modal-md', 'backdrop': 'static', 'keyboard': true },
          showCommentType: true,
          submitButtonText: translations['COMMENTS.SEND_REQUEST'],
          cancelButtonText: translations['COMMON.CANCEL'],
          placeholder: translations['COMMENTS.ENTER_COMMENTS']
        };
      })
    );
  }

  getQuote() {
    this.ngOnDestroy();
    this.quoteSubscription.push(this.activatedRoute.params
      .pipe(
        filter(params => get(params, 'id') != null),
        map(params => get(params, 'id')),
        switchMap(quoteId => {
          // Load collaboration request from cached state (already fetched by guard)
          this.loadCollaborationRequestFromState(quoteId);
          return this.quoteService.getQuoteById(quoteId);
        }),
        switchMap((quote) => {
          const quoteLineItems = LineItemService.groupItems(get(quote, 'Items'));
          this.quoteLineItems$.next(quoteLineItems);

          const firstLineItem = this.quoteLineItems$.value && this.quoteLineItems$.value.length > 0
            ? first(this.quoteLineItems$.value)
            : null;
          const configId = firstLineItem ? get(firstLineItem, 'MainLine.Configuration.Id') : null;
          if (configId) {
            this.cartRecord.Id = configId;
          }

          const lineItemsObservable = isEmpty(quoteLineItems)
            ? of(null)
            : this.cartService.addAdjustmentInfoToLineItems(this.cartRecord?.Id);

          return combineLatest([lineItemsObservable, of(quote)]);
        }),
        switchMap(([lineItems, quote]) => {
          this.cartRecord.LineItems = lineItems;
          this.cartRecord.BusinessObjectType = 'Proposal';
          this.updateComputedProperties();
          return this.updateQuoteValue(quote);
        }),
        take(1)
      ).subscribe());
    this.getAttachments();
  }

  refreshQuote(fieldValue, quote, fieldName) {
    set(quote, fieldName, fieldValue);
    const quoteItems = get(quote, 'Items');
    const payload = quote.strip(['Owner', 'Items', 'TotalCount', 'ResponseStatus']);
    this.quoteSubscription.push(this.quoteService.updateQuote(quote.Id, payload).pipe(switchMap(c => this.updateQuoteValue(c))).subscribe(r => {
      this.quote = r;
      set(this.quote, 'Items', quoteItems);
    }));
  }

  updateQuoteValue(quote: Quote): Observable<Quote> {
    return this.quoteService.updateQuoteValue(quote).pipe(
      take(1),
      map((updatedQuote: Quote) => {
        this.order$ = this.orderService.getOrderByQuote(get(updatedQuote, 'Id'));
        this.quote = updatedQuote;
        return updatedQuote;
      })
    );
  }


  acceptQuote(quoteId: string, primaryContactId: string) {
    this.acceptLoader = true;
    this.quoteService.acceptQuote(quoteId).pipe(take(1)).subscribe(
      res => {
        if (res) {
          this.acceptLoader = false;
          this.sendEmailWithTemplate(this.acceptQuoteEmailTemplateName);
          const ngbModalOptions: ModalOptions = {
            backdrop: 'static',
            keyboard: false
          };
          this.ngZone.run(() => {
            this.intimationModal = this.modalService.show(this.intimationTemplate, ngbModalOptions);
          });
        }
      },
      err => {
        this.acceptLoader = false;
      }
    );
  }

  sendEmailWithTemplate(emailTemplateName: string) {
    const userIds = [get(this.quote, 'Owner.Id'), get(this.quote, 'Requestor.Id')]
      .filter(id => !isNil(id));
    
    const getUsersObservable = userIds.length > 0 
      ? this.userService.isGuest().pipe(
          switchMap(isGuest => 
            isGuest ? of([]) : this.userService.getUsers([{
              field: 'Id',
              value: userIds.join(","),
              filterOperator: userIds.length > 1 ? FilterOperator.IN : FilterOperator.EQUAL
            }])
          )
        )
      : of([]);

    forkJoin([
      getUsersObservable,
      this.emailService.getEmailTemplateByName(emailTemplateName),
      this.contactService.getContactById(get(this.quote, 'PrimaryContact.Id'))
    ]).pipe(
      take(1),
      switchMap(([users, emailTemplate, primaryContact]: any) => {

        const emailWrappers = users.map(user => {
          return {
            EmailTemplateParameters: {
              ObjectName: "Proposal",
              RecordId: get(this.quote, 'Id'),
              TemplateData: {
                ProposalPageRoute: `proposals/${this.quote.Id}`,
                RecipientName: get(user, 'Name')
              }
            },
            EmailParameters: {
              To: [{
                Address: get(user, 'Email'),
                DisplayName: get(user, 'Name')
              }]
            }
          };
        });

        if (!isNil(primaryContact) && !isEmpty(primaryContact)) {
          emailWrappers.push({
            EmailTemplateParameters: {
              ObjectName: "Proposal",
              RecordId: get(this.quote, 'Id'),
              TemplateData: {
                ProposalPageRoute: `proposals/${this.quote.Id}`,
                RecipientName: get(primaryContact, 'Name')
              }
            },
            EmailParameters: {
              To: [{
                Address: get(primaryContact, 'Email'),
                DisplayName: get(primaryContact, 'Name')
              }]
            }
          });
        }

        // Guard check: only send email if there are recipients
        if (isEmpty(emailWrappers)) {
          return of(false);
        }

        const emailRequestPayload: EmailRequestPayload = {
          EmailTemplateId: emailTemplate.Id,
          EmailRequestWrappers: emailWrappers
        };

        return this.emailService.sendEmailByTemplate(emailRequestPayload);
      })
    ).subscribe(() => { });
  }

  rejectQuote(quoteId: string) {
    this.rejectLoader = true;
    this.quoteService.rejectQuote(quoteId).pipe(take(1)).subscribe(
      {
        next: () => {
          this.getQuote();
          this.sendEmailWithTemplate(this.rejectQuoteEmailTemplateName);
        },
        complete: () => {
          this.rejectLoader = false;
        }
      });
  }

  closeModal() {
    this.intimationModal.hide();
    this.getQuote();
  }

  editQuoteItems(quote: Quote) {
    this.editLoader = true;
    if (!isEmpty(get(quote, 'Items'))) {
      this.showProcessingOverlay();
      this.quoteService.convertQuoteToCart(quote).pipe(take(1)).subscribe(value => {
        set(value, 'Proposald', this.quote);
        this.hideProcessingOverlay();
        this.navigateToCartBasedOnAccessType();
      },
        err => {
          this.hideProcessingOverlay();
          this.exceptionService.showError(err);
          this.editLoader = false;
        })
    } else {
      this.addLineItemsToQuote(quote);
    }
  }

  addLineItemsToQuote(quote: Quote) {
    this.editLoader = true;
    this.cartService.createCartFromQuote(quote.Id).pipe(take(1)).subscribe(value => {
      set(value, 'Proposald', this.quote);
      this.navigateToCartBasedOnAccessType();
    },
      err => {
        this.exceptionService.showError(err);
        this.editLoader = false;
      })
  }

  private navigateToCartBasedOnAccessType(): void {
    const accessType = get(this.collaborationRequest, 'AccessType');
    if (accessType === CollaborationAccessType.RestrictedEdit) {
      this.ngZone.run(() => this.router.navigate(['/collaborative/cart']));
    } else {
      // For FullEdit, AcceptReject or other access types, navigate to normal cart
      this.ngZone.run(() => this.router.navigate(['/carts', 'active']));
    }
  }

  finalizeQuote(quoteId: string) {
    this.finalizeLoader = true;
    this.quoteService.finalizeQuote(quoteId).pipe(take(1)).subscribe(
      res => {
        if (res) {
          this.finalizeLoader = false;
          this.getQuote();
        }
      },
      err => {
        this.finalizeLoader = false;
      }
    );
  }

  onGenerateQuote() {
    if (this.attachmentSection) this.attachmentSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
    let obsv$;
    if (get(this.quote, 'ApprovalStage') == 'Draft') {
      const payload = { 'ApprovalStage': 'Generated', 'ProposalName': get(this.quote, 'Name') };
      obsv$ = this.quoteService.updateQuote(this.quote.Id, payload as Quote);
    } else {
      obsv$ = of(null);
    }
    combineLatest([this.emailService.getEmailTemplateByName('DC Quote generate-document Template'), obsv$]).pipe(
      switchMap(result => {
        return first(result) ? this.emailService.sendEmailNotificationWithTemplate(get(first(result), 'Id'), this.quote, get(this.quote.PrimaryContact, 'Id')) : of(null)
      }), take(1)).subscribe(() => {
        this.getQuote();
      });
    this.quoteGenerated = true;
  }

  showPresentTemplateFun() {
    this.showPresentTemplate = true;
  }

  onPresentDoc(obj: any) {
    this.showPresentTemplate = !(obj.onDocumentPage);

    if (obj.isPresentDocCompleted) {
      let obsv$;
      if (get(this.quote, 'ApprovalStage') != 'Presented') {
        const payload = { 'ApprovalStage': 'Presented' };
        obsv$ = this.quoteService.updateQuote(this.quote.Id, payload as Quote);
      } else {
        obsv$ = of(null);
      }
      obsv$.pipe(take(1)).subscribe(() => {
        this.getQuote();
      });
    }
  }


  getAttachments() {
    if (this.attachemntSubscription) this.attachemntSubscription.unsubscribe();
    this.attachemntSubscription = this.activatedRoute.params
      .pipe(
        switchMap(params => this.attachmentService.getAttachments(get(params, 'id'), 'proposal'))
      ).subscribe((attachments: Array<AttachmentDetails>) => this.ngZone.run(() => this.attachmentList$.next(attachments)));
  }

  getFileType(fileType: string): string {
    return fileType.split('/')[1];
  }


  uploadAttachments(fileInput: FileOutput) {
    this.attachmentsLoader = true;
    const fileList = fileInput.files;
    this.isPrivate = fileInput.visibility;
    // To control the visibility of files, pass the additional field "IsPrivate_c" as part of the customProperties when calling uploadMultipleAttachments.
    // You must include "IsPrivate_c" or any other custom fields passed as method parameters to the DocumentMetadata object. For more details, please refer to SDK/product documentation.
    this.attachmentService.uploadMultipleAttachments(fileList, this.quote.Id, 'Proposal', {
      IsPrivate_c: this.isPrivate
    }).pipe(take(1)).subscribe(res => {
      this.getAttachments();
      this.attachmentsLoader = false;
      this.cdr.detectChanges();
    }, err => {
      this.exceptionService.showError(err);
    });
  }

  deleteAttachment(attachment: AttachmentDetails) {
    attachment.DocumentMetadata.set('deleting', true);
    this.attachmentService.deleteAttachment(attachment.DocumentMetadata.DocumentId).pipe(take(1)).subscribe(() => {
      attachment.DocumentMetadata.set('deleting', false);
      this.getAttachments();
    })
  }

  downloadAttachment(attachmentId: string) {
    this.productInformationService.getAttachmentUrl(attachmentId).pipe(take(1)).subscribe((url: string) => {
      window.open(url, '_blank');
    });
  }

  showProcessingOverlay() {
    const customElement = this.renderer.createElement('div');
    this.renderer.addClass(customElement, 'custom-overlay');
    this.renderer.appendChild(document.body, customElement);
    this.exceptionService.showInfo('COMMON.PROCESSING_MESSAGE', 'COMMON.PROCESSING_TITLE', null, ToasterPosition.BOTTOM_LEFT, 50000, false, false, true, false);
  }

  hideProcessingOverlay() {
    const customElement = document.querySelector('.custom-overlay');
    if (customElement) {
      this.renderer.removeChild(document.body, customElement);
      this.exceptionService.clearToast();
    }
  }

  private translateQuoteStatusLabels(
    statusMap: Record<string, { Key: string; DisplayText: string }>
  ): void {
    this.quoteSubscription.push(
      this.translateService
        .stream(Object.values(statusMap).map((status) => status.DisplayText))
        .subscribe((translations) => {
          this.quoteStatusLabelMap = Object.fromEntries(
            Object.entries(statusMap).map(([statusKey, status]) => [
              statusKey,
              translations[status.DisplayText],
            ])
          );
        })
    );
  }

  openRequestChangesModal() {
    this.showReqChangesModal = false;

    setTimeout(() => {
      this.showReqChangesModal = true;
    }, 10);
  }

  handleRequestChangesAction(event: any) {
    if (event && event.action === 'close') {
      this.showReqChangesModal = false;
    }
    if (event && event.action === 'submit') {
      this.showReqChangesModal = false;

      this.showViewCommentsComponent = false;
      setTimeout(() => {
        this.showViewCommentsComponent = true;
      }, 100);
    }
  }

  handleAddCommentsChanges(event: any) {
    if (event && event.action === 'submit') {
      this.showViewCommentsComponent = false;
      setTimeout(() => {
        this.showViewCommentsComponent = true;
      }, 100);
    }
  }

  handleViewCommentsAction(event: any) {
    if (event && event.action === 'close') {
      this.showReqChangesModal = false;
    }
  }

  private loadCollaborationRequestFromState(quoteId: string): void {
    // Get collaboration request from cached state (already fetched by CollaborationAuthGuard)
    combineLatest([
      this.userService.me(),
      this.userService.isLoggedIn(),
      this.collaborationService.getMyCollaborationRequest('Proposal', quoteId)
    ]).pipe(
      take(1)
    ).subscribe(([user, isLoggedIn, request]) => {
      this.isLoggedIn = isLoggedIn;

        if (request) {
          this.collaborationRequest = request;
          this.currentUserId = get(user, 'Id');
          this.isAnonymous = request.AuthenticationType === CollaborationAuthenticationType.Anonymous;
          // For authenticated collaboration, check against RecordOwner
          if (isLoggedIn && !this.isAnonymous) {
            const recordOwnerId = get(request, 'RecordOwner.Id');
            this.isRecordOwner = recordOwnerId === this.currentUserId;
          }
          
        } else {
          this.collaborationRequest = null;
          this.isRecordOwner = true;
          this.isAnonymous = false;
        }

        this.updateComputedProperties();
        this.cdr.detectChanges();
      });
  }

  private updateComputedProperties(): void {
    // No collaboration request means full access for the user
    if (!this.collaborationRequest) {
      this.canManageLineItems = true;
      this.canEditQuoteFields = true;
      this.canShowCollaborationActions = true;
      return;
    }

    const accessType = get(this.collaborationRequest, 'AccessType');
    const authType = get(this.collaborationRequest, 'AuthenticationType');
    const hasLineItems = this.quoteLineItems$?.value && this.quoteLineItems$.value.length > 0;

    // Edit existing items: Record owner can edit unless access is AcceptReject
    const canEditExistingItems = this.isRecordOwner && accessType !== CollaborationAccessType.AcceptReject;
    // Add new items: Only record owner with full authenticated login access.
    const canAddNewItems = this.isRecordOwner && authType === CollaborationAuthenticationType.AuthenticatedWithLogin && accessType === CollaborationAccessType.FullEdit;
    this.canManageLineItems = hasLineItems ? canEditExistingItems : canAddNewItems;

    // Quote fields: editable by logged-in record owners, but not for anonymous users who logged in or restricted access types
    const isAnonymousWithLoggedInUser = authType === CollaborationAuthenticationType.Anonymous && this.isLoggedIn;
    const isRestrictedAccess = accessType === CollaborationAccessType.RestrictedEdit || accessType === CollaborationAccessType.AcceptReject;
    this.canEditQuoteFields = this.isLoggedIn && this.isRecordOwner && !isAnonymousWithLoggedInUser && !isRestrictedAccess;

    // For Anonymous auth: Hide all actions once they log in
    if (authType === CollaborationAuthenticationType.Anonymous && this.isLoggedIn) {
      this.canShowCollaborationActions = false;
    // For AuthenticatedWithLogin: Only show for record owner
    } else if (authType === CollaborationAuthenticationType.AuthenticatedWithLogin && !this.isRecordOwner) {
      this.canShowCollaborationActions = false;
    // For other auth types: Show for all users
    } else {
      this.canShowCollaborationActions = true;
    }
  }

  ngOnDestroy() {
    if (this.attachemntSubscription)
      this.attachemntSubscription.unsubscribe();
    this.quoteSubscription.forEach(subscription => subscription.unsubscribe());

    if (this.intimationModal) {
      this.intimationModal.hide();
    }
  }
}

