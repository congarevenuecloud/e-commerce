import { Component, OnInit, ViewChild, TemplateRef, NgZone, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, ViewEncapsulation, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map, take, mergeMap, switchMap, startWith, tap } from 'rxjs/operators';
import { get, set, compact, uniq, find, cloneDeep, sum, defaultTo, first, map as _map } from 'lodash';
import { Observable, of, BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { ApiService } from '@congarevenuecloud/core';
import {
  UserService, QuoteService, Quote, Order, OrderService, Note, NoteService, AttachmentService,
  AttachmentDetails, ProductInformationService, ItemGroup, EmailService, LineItemService, QuoteLineItemService, Account, AccountService, Contact, ContactService, LineItem, QuoteLineItem
} from '@congarevenuecloud/ecommerce';
import { ExceptionService, LookupOptions, RevalidateCartService } from '@congarevenuecloud/elements';
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

  note: Note = new Note();

  newlyGeneratedOrder: Order;

  intimationModal: BsModalRef;

  hasSizeError: boolean;

  file: File;

  uploadFileList: any;

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
    private revalidateCartService: RevalidateCartService) { }

    ngOnInit() {
      this.getQuote();
    }

    getQuote() {
      this.ngOnDestroy();
      this.quoteSubscription.push(this.activatedRoute.params
        .pipe(
          filter(params => get(params, 'id') != null),
          map(params => get(params, 'id')),
          switchMap(quoteId => combineLatest([this.quoteService.getQuoteById(quoteId), this.userService.isLoggedIn()])),
          switchMap(([quote, isLoggedIn]) => {
            this.quoteLineItems$.next(LineItemService.groupItems(get(quote, 'Items')));
            this.isLoggedIn = isLoggedIn;
            return this.updateQuoteValue(quote);
          }
          )).subscribe());
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
      this.quoteService.convertQuoteToCart(quote).pipe(take(1)).subscribe(value => {
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
      this.getQuote();
      this.quoteGenerated = true;
    }

    /**
     * @ignore
     */
    clearFiles() {
      this.file = null;
      this.uploadFileList = null;
      this.attachmentsLoader = false;
      this.isPrivate = false;
    }

    /**
     * @ignore
     */
    getAttachments() {
      if (this.attachemntSubscription) this.attachemntSubscription.unsubscribe();
      this.attachemntSubscription = this.activatedRoute.params
        .pipe(
          switchMap(params => this.attachmentService.getAttachments(get(params, 'id'), 'proposal'))
        ).subscribe((attachments: Array<AttachmentDetails>) => this.ngZone.run(() => this.attachmentList$.next(attachments)));
    }

    /**
     * @ignore
     */
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

    /**
     * @ignore
     */
    downloadAttachment(attachmentId: string) {
      this.productInformationService.getAttachmentUrl(attachmentId).subscribe((url: string) => {
        window.open(url, '_blank');
      });
    }

    /**
     * @ignore
     */
    hasFileSizeExceeded(fileList, maxSize) {
      let totalFileSize = 0;
      for (let i = 0; i < fileList.length; i++) {
        totalFileSize = totalFileSize + fileList[i].size;
      }
      this.hasSizeError = totalFileSize > maxSize;
    }

    /**
     * @ignore
     */
    fileChange(event) {
      const fileList: FileList = event.target.files;
      if (fileList.length > 0) {
        this.uploadFileList = event.target.files;
        this.hasFileSizeExceeded(this.uploadFileList, this.maxFileSizeLimit);
        this.file = fileList[0];
      }
    }

    /**
     * @ignore
     */
    onDragFile(event) {
      event.preventDefault();
    }

    /**
     * @ignore
     */
    onDropFile(event) {
      event.preventDefault();
      const itemList: DataTransferItemList = event.dataTransfer.items;
      const fileList: FileList = event.dataTransfer.files;
      if (fileList.length > 0) {
        this.uploadFileList = event.dataTransfer.files;
        this.hasFileSizeExceeded(this.uploadFileList, event.target.dataset.maxSize);
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

    ngOnDestroy() {
      if (this.notesSubscription)
        this.notesSubscription.unsubscribe();
      if (this.attachemntSubscription)
        this.attachemntSubscription.unsubscribe();
      this.quoteSubscription.forEach(subscription => subscription.unsubscribe());
    }
  }

