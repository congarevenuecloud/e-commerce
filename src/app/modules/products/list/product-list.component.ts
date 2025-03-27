import { Component, OnInit, OnDestroy, SecurityContext } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { get, isNil, isEmpty, toString, toNumber, set, isEqual, remove, debounce } from 'lodash';
import { FilterOperator, PlatformConstants } from '@congarevenuecloud/core';
import { Category, ProductService, ProductResult, PreviousState, FieldFilter, AccountService, CategoryService, FavoriteService, Product, FacetFilter, FacetFilterPayload, Quote, CartService, StorefrontService, FavoriteResult, Favorite } from '@congarevenuecloud/ecommerce';
import { BatchSelectionService, ExceptionService } from '@congarevenuecloud/elements';
/**
 * Product list component shows all the products in a list for user selection.
 */
@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  /**
   * Current page used by the pagination component. Default is 1.
   */
  page = 1;
  /**
   * Number of records per page used by the pagination component. Default is 12.
   */
  pageSize = 12;
  /**
   * Layout in which one wants to see products. Grid/list. Default is Grid.
   */
  view = 'grid';
  /**
   * A field name on which one wants to apply sorting.
   */
  sortField: string = 'Name';
  /**
   * Value of the product family field filter.
   */
  productFamilyFilter: Array<FieldFilter>;
  /**
   * Condition to filter products from all products.
   */
  /**
   * Used to hold the current array of subcategories that are selected.
   */
  subCategories: Array<Category> = [];
  /**
   * Flag to check if enableOneTime is true or false
   */
  enableOneTime$: Observable<boolean>;
  /**
   * Search query to filter products list from grid.
   */
  searchString: string = null;
  data$: BehaviorSubject<ProductResult> = new BehaviorSubject<ProductResult>(null);
  productFamilies$: Observable<Array<string>> = new Observable<Array<string>>();
  category: Category;
  subscriptions: Array<Subscription> = [];
  hasSearchError: boolean;
  moveToLast: boolean = false;
  productResult: PreviousState;
  private static VIEW_KEY: string = PlatformConstants.PAGE_VIEW;
  private static PAGESIZE_KEY: string = PlatformConstants.PAGE_SIZE;
  private PRICELIST_KEY: string = PlatformConstants.PRICELIST_ID;
  product = new Product();
  facetFilterPayload: FacetFilterPayload;
  // Observable to hold the 'FavoriteResult' object containing the list of favorites and the total record count.
  favorites$: BehaviorSubject<FavoriteResult> = new BehaviorSubject<FavoriteResult>(null);
  // Array of filters to apply on the favorite catalog.
  filters: Array<FieldFilter>;
  // Search string for the favorite catalog.
  favoriteSearchString: string = '';
  // Flag to check if the current view is the favorite catalog
  isFavoriteCatalog: boolean = false;
  // Object to hold the loading state of the favorite records being added to the cart.
  isLoading: Object = {};

  /**
   * Control over button's text/label of pagination component for Multi-Language Support
   */
  paginationButtonLabels: any = {
    first: '',
    previous: '',
    next: '',
    last: ''
  };
  fields: string[];
  object: any;
  businessObjectFields: string[];
  selectedCount: number = 0;
  /**
   * Array of product families associated with the list of assets.
   */

  /**
   * @ignore
   */

  constructor(private activatedRoute: ActivatedRoute, private sanitizer: DomSanitizer,
    private router: Router, private categoryService: CategoryService, public batchSelectionService: BatchSelectionService,
    public productService: ProductService, private translateService: TranslateService, private accountService: AccountService, private cartService: CartService,
    private storefrontService: StorefrontService, private favoriteService: FavoriteService, private exceptionService: ExceptionService) { }


  ngOnInit() {
    this.subscriptions.push(
      this.router.events.subscribe((eventname: NavigationStart) => {
        if (eventname.navigationTrigger === 'popstate' && eventname instanceof NavigationStart) {
          this.productService.eventback.next(true);
        }
      })
    );
    const currentUrl = this.router.url;
    // Check if the URL contains "products/favorites"
    if (currentUrl.includes('products/favorites')) {
      this.isFavoriteCatalog = true;
    }

    this.subscriptions.push(
      this.accountService.getCurrentAccount().subscribe(() => this.getResults(this.isFavoriteCatalog ? 'favorite' : 'product'))
    );
    this.productFamilies$ = this.productService.getFieldPickList('Family');
    this.subscriptions.push(
      this.translateService.stream('PAGINATION').subscribe((val: string) => {
        this.paginationButtonLabels.first = val['FIRST'];
        this.paginationButtonLabels.previous = val['PREVIOUS'];
        this.paginationButtonLabels.next = val['NEXT'];
        this.paginationButtonLabels.last = val['LAST'];
      })
    );
    this.enableOneTime$ = this.storefrontService.isOneTimeChangeEnabled();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getResults(type: 'product' | 'favorite' = 'product') {
    this.ngOnDestroy();
    if (type === 'product') {
      this.subscriptions.push(
        this.activatedRoute.params.pipe(
          mergeMap(params => {
            if (this.productService.eventback.value) {
              this.page = this.productService.getState().page;
              this.sortField = this.productService.getState().sort;
            }
            this.view = isNil(ProductService.getValue(ProductListComponent.VIEW_KEY)) ? this.view : ProductService.getValue(ProductListComponent.VIEW_KEY);
            this.pageSize = isNil(ProductService.getValue(ProductListComponent.PAGESIZE_KEY)) ? this.pageSize : toNumber(ProductService.getValue(ProductListComponent.PAGESIZE_KEY));
            this.productResult = { sort: this.sortField, page: this.page }
            this.productService.publish(this.productResult);
            this.data$.next(null);
            this.hasSearchError = false;
            this.searchString = get(params, 'query');
            this.searchString = this.sanitizer.sanitize(
              SecurityContext.URL,
              this.searchString
            );
            let categories = null;
            const sortBy = this.sortField === 'Name' ? this.sortField : null;
            if (!isNil(get(params, 'categoryId')) && isEmpty(this.subCategories)) {
              this.category = new Category();
              this.category.Id = get(params, 'categoryId');
              categories = [get(params, 'categoryId')];
            } else if (!isEmpty(this.subCategories)) {
              categories = this.subCategories.map(category => category.Id);
            }

            if (get(this.searchString, 'length') < 3) {
              this.hasSearchError = true;
              return of(null);
            } else {
              return combineLatest([this.productService.getProducts(categories, this.pageSize, this.page, sortBy, 'ASC', this.searchString, null, null, this.productFamilyFilter, this.facetFilterPayload, true, { cacheKey: localStorage.getItem(this.PRICELIST_KEY) }), this.categoryService.getCategories()]);
            }
          })
        ).subscribe(([r, categories]) => {
          if (!isEmpty(this.facetFilterPayload)) set(r, 'Facets', this.facetFilterPayload);
          this.data$.next(r);
          if (isNil(categories)) this.category = new Category();
          else if (!this.category || !this.category.Id)
            this.category = null;

          if (this.moveToLast) {
            this.onPage({
              'itemPerPage': this.pageSize,
              'page': this.page + 1
            })
          }
          this.moveToLast = false;
        })
      );
      this.fields = ['AdjustmentType', 'AdjustmentAmount', 'StartDate', 'EndDate'];
      this.businessObjectFields = ['Description', 'BillToAccount', 'Amount', 'ModifiedDate', 'AutoActivateOrder', 'ABOType', 'DiscountPercent', 'configurationSyncDate', 'SourceChannel', 'PONumber']
      this.object = new Quote();
      this.subscriptions.push(
        this.batchSelectionService.getSelectedProducts().subscribe((data) => {
          this.selectedCount = data?.length ? data.length : 0;
        }));
    }
    else if (type === 'favorite') {
      this.favorites$.next(null);

      this.subscriptions.push(
        this.favoriteService.getMyFavorites(this.favoriteSearchString || null, this.filters?.length === 1 ? this.filters : null, this.pageSize, this.page, this.sortField === 'Name' ? this.sortField : null, 'ASC')
          .subscribe(favorites => {
            if (isNil(favorites?.FavoriteList) && isNil(favorites?.TotalRecord)) {
              this.favorites$.next({ FavoriteList: [], TotalRecord: 0 });
              return;
            }
            this.favorites$.next(favorites);
          })
      );
    }
  }

  // Debounce the searchFavorites method to avoid multiple API calls.
  searchFavorites(evt: string) {
    this.favoriteSearchString = evt.trim();
    this.page = 1;
    if (!this.favoriteSearchString) {
      this.favorites$.next(null);
    }
    debounce(() => this.getResults('favorite'), 1000)();
  }

  /**
   * This function helps at UI to scroll at the top of the product list.
   */
  scrollTop() {
    const c = document.documentElement.scrollTop || document.body.scrollTop;
    if (c > 0) {
      window.requestAnimationFrame(this.scrollTop);
      window.scrollTo(0, c - c / 8);
    }
  }

  /**
   * Filters peers Category from the categorylist.
   * @param categoryList Array of Category.
   */
  onCategory(categoryList: Array<Category>) {
    const category: Category = get(categoryList, '[0]');
    if (category) {
      this.subCategories = [];
      this.page = 1;
      this.router.navigate(['/products/category', category.Id]);
    }
  }

  // Handles the pagination event and updates the current page.
  onPage(evt, filterType: 'product' | 'favorite' = 'product') {
    if (get(evt, 'page') !== this.page) {
      this.page = evt.page;
      this.getResults(filterType);
    }
  }

  onPriceTierChange(evt) {
    this.page = 1;
    this.getResults();
  }


  // Adds filter conditions to the appropriate type (product or favorite) and fetches updated results.
  onFilterAdd(condition: Array<FieldFilter>, filterType: 'product' | 'favorite' = 'product') {
    this.page = 1;
    if (filterType === 'product') {
      this.productFamilyFilter = this.productFamilyFilter ?? [];
      this.productFamilyFilter.push(...condition);
      this.isFavoriteCatalog = false;
      this.getResults();
    } else if (filterType === 'favorite') {
      this.filters = condition;
      if (this.isFavoriteCatalog) {
        this.getResults(filterType);
      }
      else
        this.router.navigate(['/products/favorites']);
    }
  }


  /**
   * Removes filter conditions from the products grid and fetches updated results.
   * @param conditions Array of FieldFilter conditions to remove.
   */
  onFilterRemove(conditions: Array<FieldFilter>) {
    this.productFamilyFilter = this.productFamilyFilter.filter(
      (c) => !conditions.some(condition => isEqual(c, condition)));
    this.page = 1;
    this.getResults();
  }

  /**
   * Filters child category from the categorylist.
   * @param categoryList Array of Category.
   */
  onSubcategoryFilter(categoryList: Array<Category>) {
    this.subCategories = categoryList;
    this.page = 1;
    this.getResults();
  }

  onFieldFilter(evt) {
    this.page = 1;
    this.getResults();
  }

  onView(evt) {
    this.view = evt;
    ProductService.setValue(ProductListComponent.VIEW_KEY, this.view);
    this.getResults();
  }

  //Handles the change in sorting order for the products or favorites.
  onSortChange(evt, filterType: 'product' | 'favorite' = 'product') {
    this.page = 1;
    this.sortField = evt;
    this.getResults(filterType);
  }

  //Handles the change in page size for the products or favorites.
  onPageSizeChange(event, filterType: 'product' | 'favorite' = 'product') {
    const recordCount = filterType === 'product' ? get(this.data$.value, 'TotalRecord') : get(this.favorites$.value, 'TotalRecord');
    this.pageSize = event;
    if (this.page * this.pageSize > recordCount) {
      this.page = Math.floor(recordCount / this.pageSize);
      this.moveToLast = (this.page !== 0 && recordCount % this.pageSize !== 0);
      if (this.page === 0) this.page++;
    }
    ProductService.setValue(ProductListComponent.PAGESIZE_KEY, toString(this.pageSize));
    this.getResults(filterType);
  }

  /**
   * Filter on products grid by product family.
   * @param event Event Object that was fired.
   */
  handlePicklistChange(event: any) {
    this.productFamilyFilter = null;
    if (event.length > 0) {
      const values = [];
      event.forEach(item => values.push(item));
      this.productFamilyFilter = [{
        field: 'Family',
        value: values,
        filterOperator: values.length > 1 ? FilterOperator.IN : FilterOperator.EQUAL
      }] as Array<FieldFilter>;
    }
    this.getResults();
  }

  getFacetFilterSelection(record: Array<FacetFilter> | FacetFilterPayload) {
    this.facetFilterPayload = (get(record, 'facets') ? record : { facets: record }) as FacetFilterPayload
    this.getResults();
  }

  // Method to add a favorite record to the current cart
  addFavoriteToCart(favorite: Favorite) {
    this.isLoading[favorite.Id] = true;
    this.subscriptions.push(
      this.favoriteService.addFavoriteToCart(favorite).subscribe(
        (res) => {
          this.isLoading[favorite.Id] = false;
          if (res == true) {
            this.exceptionService.showSuccess('SUCCESS.FAVORITE.ADD_FAVORITE_TO_CART', 'SUCCESS.FAVORITE.TITLE', { name: favorite.Name });
          } else {
            this.exceptionService.showError('ERROR.FAVORITE.ADD_FAVORITE_TO_CART_FAILED');
          }
        }
      )
    );
  }
}