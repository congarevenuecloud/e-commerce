import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, take, tap } from 'rxjs/operators';
import { get } from 'lodash';
import { PlatformConstants } from '@congarevenuecloud/core';
import { QuoteService, PriceListService, Quote, CartService } from '@congarevenuecloud/ecommerce';

// DSR storage keys
export enum DsrConstants {
  MODE_KEY = 'dsrMode',
  QUOTE_ID_KEY = 'dsrQuoteId',
  EDITED_LINE_ITEMS_KEY = 'dsrEditedLineItems',
}

// DSR session state interface 
export interface DsrSessionState {
  isDsrMode: boolean;
  quoteId: string | null;
  priceListId: string | null;
  quote: Quote | null;
  editedLineItems: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DsrService {

   // Storage keys
  private readonly DSR_MODE_KEY = DsrConstants.MODE_KEY;
  private readonly DSR_QUOTE_ID_KEY = DsrConstants.QUOTE_ID_KEY;
  private readonly PRICELIST_ID_KEY = PlatformConstants.PRICELIST_ID;
  private readonly DSR_EDITED_LINE_ITEMS_KEY = DsrConstants.EDITED_LINE_ITEMS_KEY;

   // BehaviorSubject for reactive DSR state management
  private dsrState$ = new BehaviorSubject<DsrSessionState>({
    isDsrMode: false,
    quoteId: null,
    priceListId: null,
    quote: null,
    editedLineItems: false
  });

  constructor(
    private quoteService: QuoteService,
    private priceListService: PriceListService,
    private cartService: CartService
  ) {
    // Initialize state from storage on service creation
    this.initializeStateFromStorage();
  }



   // Initialize DSR state from localStorage on service startup
   // Clear stale pricelist if not in DSR mode
  private initializeStateFromStorage(): void {
    const isDsrMode = localStorage.getItem(this.DSR_MODE_KEY) === 'true';
    const quoteId = localStorage.getItem(this.DSR_QUOTE_ID_KEY);
    const priceListId = localStorage.getItem(this.PRICELIST_ID_KEY);
    const editedLineItems = localStorage.getItem(this.DSR_EDITED_LINE_ITEMS_KEY) === 'true';

    if (isDsrMode) {
      this.dsrState$.next({
        isDsrMode: true,
        quoteId: quoteId,
        priceListId: priceListId,
        quote: null,
        editedLineItems: editedLineItems
      });
    } else {
      // Not in DSR mode - clear any stale pricelist and restore default
      // This ensures normal ecommerce startup uses the correct default pricelist
      if (priceListId) {
        localStorage.removeItem(this.PRICELIST_ID_KEY);
        // Restore default pricelist
        this.priceListService.refreshPriceList();
      }
    }
  }

  // Get the observable DSR state
  getDsrState(): Observable<DsrSessionState> {
    return this.dsrState$.asObservable();
  }

   // Check if DSR mode is currently active
  isDsrMode(): boolean {
    return localStorage.getItem(this.DSR_MODE_KEY) === 'true';
  }

   // Get the current DSR quote ID
  getDsrQuoteId(): string | null {
    return localStorage.getItem(this.DSR_QUOTE_ID_KEY);
  }

   // Get the current DSR pricelist ID
  getDsrPriceListId(): string | null {
    return this.dsrState$.value.priceListId;
  }

   // Activate DSR mode with a quote
  activateDsrMode(quoteId: string, setPriceList: boolean = true): Observable<DsrSessionState> {
    return this.quoteService.getQuote(quoteId).pipe(
      take(1),
      map((quote: Quote) => {
        const priceListId = get(quote, 'PriceList.Id');

        // Store in localStorage
        localStorage.setItem(this.DSR_MODE_KEY, 'true');
        localStorage.setItem(this.DSR_QUOTE_ID_KEY, quoteId);

        if (priceListId && setPriceList) {
          localStorage.setItem(this.PRICELIST_ID_KEY, priceListId);
        }

        const state: DsrSessionState = {
          isDsrMode: true,
          quoteId: quoteId,
          priceListId: priceListId,
          quote: quote,
          editedLineItems: false
        };

        this.dsrState$.next(state);

        return state;
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

   // Deactivate DSR mode and clear storage state
  deactivateDsrMode(preservePriceList: boolean = false, cleanupCart: boolean = true): Observable<boolean> {
    const editedLineItems = localStorage.getItem(this.DSR_EDITED_LINE_ITEMS_KEY) === 'true';
    const shouldCleanupCart = cleanupCart && editedLineItems;

    // Clear DSR pricelist immediately to prevent it from persisting
    if (!preservePriceList) {
      localStorage.removeItem(this.PRICELIST_ID_KEY);
    }

    const restorePricelist$ = !preservePriceList 
      ? of(null).pipe(
          tap(() => this.priceListService.refreshPriceList()),
          switchMap(() => this.priceListService.getPriceList()),
          take(1),
          map(() => true)
        )
      : of(true);

    const deactivateState$ = shouldCleanupCart
      ? this.abandonCurrentCart().pipe(
          switchMap(() => restorePricelist$),
          switchMap(() => this.createAndActivateNewCart())
        )
      : restorePricelist$;
    
    return deactivateState$.pipe(
      tap(() => {
        // Clear DSR localStorage
        localStorage.removeItem(this.DSR_MODE_KEY);
        localStorage.removeItem(this.DSR_QUOTE_ID_KEY);
        localStorage.removeItem(this.DSR_EDITED_LINE_ITEMS_KEY);

        this.dsrState$.next({
          isDsrMode: false,
          quoteId: null,
          priceListId: preservePriceList ? localStorage.getItem(this.PRICELIST_ID_KEY) : null,
          quote: null,
          editedLineItems: false
        });

      })
    );
  }

   // Abandon current active cart.

  private abandonCurrentCart(): Observable<boolean> {

    return this.cartService.getMyCart().pipe(
      take(1),
      switchMap(cart => {
        const cartId = get(cart, 'Id');
        
        if (!cartId) {
          return of(true);
        }
        
        return this.cartService.abandonCart(cartId).pipe(map(() => true));
      }),
      take(1),
      catchError(error => {
        this.cartService.deleteLocalCart();
        return of(true);
      })
    );
  }

   // Create and activate a new cart after pricelist restoration.

  private createAndActivateNewCart(): Observable<boolean> {

    return this.cartService.createNewCart().pipe(
      switchMap(newCart => {
        return this.cartService.setCartActive(newCart);
      }),
      map(() => {
        return true;
      }),
      catchError(error => {
        this.cartService.deleteLocalCart();
        return of(true);
      })
    );
  }

   // Mark that the user is editing line items in DSR mode
   // This is called when navigating to cart to edit line items from quote details
  setEditingLineItems(): void {
    if (this.isDsrMode()) {
      localStorage.setItem(this.DSR_EDITED_LINE_ITEMS_KEY, 'true');
      const currentState = this.dsrState$.value;
      this.dsrState$.next({
        ...currentState,
        editedLineItems: true
      });
    }
  }

   // Check if user has edited line items in current DSR session
  hasEditedLineItems(): boolean {
    return localStorage.getItem(this.DSR_EDITED_LINE_ITEMS_KEY) === 'true';
  }

  // Clear the editing line items flag
   // This should be called after user discards changes or finalizes the quote
  clearEditingLineItems(): void {
    localStorage.removeItem(this.DSR_EDITED_LINE_ITEMS_KEY);
    const currentState = this.dsrState$.value;
    this.dsrState$.next({
      ...currentState,
      editedLineItems: false
    });
  }
}
