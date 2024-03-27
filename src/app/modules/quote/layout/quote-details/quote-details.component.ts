import { Component, OnInit, ViewChild, TemplateRef, NgZone, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, ViewEncapsulation, ElementRef, Inject, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map, take, mergeMap, switchMap, startWith, tap } from 'rxjs/operators';
import { get, set, compact, uniq, find, cloneDeep, sum, defaultTo, first, map as _map, isEmpty } from 'lodash';
import { Observable, of, BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { ApiService } from '@congarevenuecloud/core';
import {
  UserService, QuoteService, Quote, Order, OrderService, Note, NoteService, AttachmentService,
  AttachmentDetails, ProductInformationService, ItemGroup, EmailService, LineItemService, QuoteLineItemService, Account, AccountService, Contact, ContactService, LineItem, QuoteLineItem,
  CartService, Cart
} from '@congarevenuecloud/ecommerce';
import { ExceptionService, LookupOptions, RevalidateCartService, ToasterPosition } from '@congarevenuecloud/elements';
import { DOCUMENT } from '@angular/common';
@Component({
  selector: 'app-quote-details',
  templateUrl: './quote-details.component.html',
  styleUrls: ['./quote-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class QuoteDetailsComponent implements OnInit, OnDestroy {

  quote$: BehaviorSubject<Quote> = new BehaviorSubject<Quote>(null);
  quoteLineItems$: BehaviorSubject<Array<ItemGroup>> = new BehaviorSubject<Array<ItemGroup>>(null);
  attachmentList$: BehaviorSubject<Array<AttachmentDetails>> = new BehaviorSubject<Array<AttachmentDetails>>(null);
  noteList$: BehaviorSubject<Array<Note>> = new BehaviorSubject<Array<Note>>(null);
  order$: Observable<Order>;
  quote

  @ViewChild('attachmentSection') attachmentSection: ElementRef;
  @ViewChild('fileInput') fileInput: ElementRef;

  note: Note = new Note();

  newlyGeneratedOrder: Order;

  intimationModal: BsModalRef;

  hasSizeError: boolean;

  file: File;

  uploadFileList: any;

  isSupportedFileType:boolean = true;

  supportedFileTypes:string;

  editLoader = false;

  acceptLoader = false;

  commentsLoader = false;

  attachmentsLoader = false;

  finalizeLoader = false;

  quoteGenerated: boolean = false;

  notesSubscription: Subscription;

  attachemntSubscription: Subscription;

  quoteSubscription: Subscription[] = [];

  quoteStatusSteps = [
    'Draft',
    'Approved',
    'Generated',
    'Presented',
    'Accepted'
  ];

  quoteStatusMap = {
    'Draft': 'Draft',
    'Approval Required': 'Approval Required',
    'In Review': 'In Review',
    'Approved': 'Approved',
    'Generated': 'Generated',
    'Presented': 'Presented',
    'Accepted': 'Accepted',
    'Denied': 'Denied'
  }

  isLoggedIn: boolean;

  @ViewChild('intimationTemplate') intimationTemplate: TemplateRef<any>;

  lookupOptions: LookupOptions = {
    primaryTextField: 'Name',
    secondaryTextField: 'Email',
    fieldList: ['Id', 'Name', 'Email']
  };

  isPrivate: boolean = false;
  maxFileSizeLimit = 29360128;
  cartRecord: Cart;

  constructor(private activatedRoute: ActivatedRoute,
    private quoteService: QuoteService,
    private noteService: NoteService,
    private exceptionService: ExceptionService,
    private modalService: BsModalService,
    private orderService: OrderService,
    private emailService: EmailService,
    private attachmentService: AttachmentService,
    private productInformationService: ProductInformationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private userService: UserService,
    private apiService: ApiService,
    private quoteLineItemService: QuoteLineItemService,
    private accountService: AccountService,
    private contactService: ContactService,
    private router: Router,
    private revalidateCartService: RevalidateCartService,
    private cartService: CartService,
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2) { }

  ngOnInit() {
    this.getQuote();
    this.quoteSubscription.push(this.attachmentService.getSupportedAttachmentType().pipe(
      take(1)
    ).subscribe((data: string)=>{
      this.supportedFileTypes = data;
    }))
  }

  getQuote() {
    this.ngOnDestroy();
    this.quoteSubscription.push(this.activatedRoute.params
      .pipe(
        filter(params => get(params, 'id') != null),
        map(params => get(params, 'id')),
        switchMap(quoteId => combineLatest([this.quoteService.getQuoteById(quoteId), this.userService.isLoggedIn()])),
        switchMap(([quote, isLoggedIn]) => {
          const quoteLineItems = LineItemService.groupItems(get(quote, 'Items'));
          this.quoteLineItems$.next(quoteLineItems);
          this.isLoggedIn = isLoggedIn;
          return combineLatest([isEmpty(quoteLineItems) ? of(null) : (this.cartService.fetchCartStatus(get(get(first(this.quoteLineItems$.value), 'MainLine.Configuration'), 'Id'))), of(quote)])
        }),
        take(1),
        switchMap(([cartRecord, quote]) => {
          this.cartRecord = cartRecord;
          return this.updateQuoteValue(quote);
        })
      ).subscribe());
    this.getAttachments();
  }

  // TO DO:: output field need to handle update of buisnessObject
  refreshQuote(fieldValue, quote, fieldName) {
    set(quote, fieldName, fieldValue);
    const payload = quote.strip(['Owner', 'Items', 'TotalCount', 'ResponseStatus']);
    this.quoteSubscription.push(this.quoteService.updateQuote(quote.Id, payload).pipe(switchMap(c => this.updateQuoteValue(c))).subscribe(r => {
      this.quote = r;
    }))
  }

  updateQuoteValue(quote): Observable<Quote> {
    return combineLatest([
      of(quote),
      this.accountService.getCurrentAccount(),
      get(quote.BillToAccount, 'Id') ? this.accountService.getAccount(get(quote.BillToAccount, 'Id')) : of(null),
      get(quote.ShipToAccount, 'Id') ? this.accountService.getAccount(get(quote.ShipToAccount, 'Id')) : of(null),
      get(quote.PrimaryContact, 'Id') ? this.contactService.fetch(get(quote.PrimaryContact, 'Id')) : of(null)
    ]).pipe(map(([quote, accounts, billToAccount, shipToAccount, primaryContact]) => {
      quote.Account = defaultTo(find([accounts], acc => get(acc, 'Id') === get(quote.Account, 'Id')), quote.Account);
      quote.BillToAccount = billToAccount;
      quote.ShipToAccount = shipToAccount;
      quote.PrimaryContact = defaultTo(primaryContact, quote.PrimaryContact) as Contact;;
      set(quote, 'Items', LineItemService.groupItems(get(quote, 'Items')));
      this.order$ = this.orderService.getOrderByQuote(get(quote, 'Id'));
      this.quote = quote;
      return this.quote;
    }))
  }


  acceptQuote(quoteId: string, primaryContactId: string) {
    this.acceptLoader = true;
    this.quoteService.acceptQuote(quoteId).pipe(take(1)).subscribe(
      res => {
        if (res) {
          this.acceptLoader = false;
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
        this.ngZone.run(() => this.router.navigate(['/carts', 'active']));
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
      this.ngZone.run(() => this.router.navigate(['/carts', 'active']));
    },
      err => {
        this.exceptionService.showError(err);
        this.editLoader = false;
      })
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
      const payload = { 'ApprovalStage': 'Generated' };
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


  clearFiles() {
    this.file = null;
    this.uploadFileList = null;
    this.attachmentsLoader = false;
    this.isPrivate = false;
    this.fileInput.nativeElement.value = null;
    this.isSupportedFileType = true;
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


  uploadAttachment(parentId: string) {
    this.attachmentsLoader = true;
    this.attachmentService.uploadAttachment(this.file, this.isPrivate, parentId, 'proposal').pipe(take(1)).subscribe(res => {
      this.getAttachments();
      this.attachmentsLoader = false;
      this.clearFiles();
      this.cdr.detectChanges();
    }, err => {
      this.clearFiles();
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
    this.productInformationService.getAttachmentUrl(attachmentId).subscribe((url: string) => {
      window.open(url, '_blank');
    });
  }


  hasFileSizeExceeded(fileList, maxSize) {
    let totalFileSize = 0;
    for (let i = 0; i < fileList.length; i++) {
      totalFileSize = totalFileSize + fileList[i].size;
    }
    this.hasSizeError = totalFileSize > maxSize;
  }


  fileChange(event) {
    const fileList: FileList = event.target.files;
    if (fileList.length > 0) {
      this.uploadFileList = event.target.files;
      this.hasFileSizeExceeded(this.uploadFileList, this.maxFileSizeLimit);
      this.file = fileList[0];
      this.isSupportedFileType = this.attachmentService.checkSupportedFileType(this.uploadFileList,this.supportedFileTypes);
    }
  }


  onDragFile(event) {
    event.preventDefault();
  }


  onDropFile(event) {
    event.preventDefault();
    const itemList: DataTransferItemList = event.dataTransfer.items;
    const fileList: FileList = event.dataTransfer.files;
    if (fileList.length > 0) {
      this.uploadFileList = event.dataTransfer.files;
      this.hasFileSizeExceeded(this.uploadFileList, event.target.dataset.maxSize);
      this.isSupportedFileType = this.attachmentService.checkSupportedFileType(this.uploadFileList,this.supportedFileTypes);
    } else {
      let f = [];
      for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].kind === 'file') {
          let file: File = itemList[i].getAsFile();
          f.push(file);
        }
        this.uploadFileList = f;
      }
      this.hasFileSizeExceeded(fileList, event.target.dataset.maxSize);
    }
    this.file = this.uploadFileList[0];
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

  ngOnDestroy() {
    if (this.notesSubscription)
      this.notesSubscription.unsubscribe();
    if (this.attachemntSubscription)
      this.attachemntSubscription.unsubscribe();
    this.quoteSubscription.forEach(subscription => subscription.unsubscribe());
  }
}

