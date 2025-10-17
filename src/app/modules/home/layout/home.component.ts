import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, of, Subscription, combineLatest } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { first, get, forEach, isNil } from 'lodash';
import { Product, CategoryService, ProductService, Category, UserService, ItemRequest, GuestUserService } from '@congarevenuecloud/ecommerce';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  productListA$: Observable<Array<ItemRequest>>;

  productListB$: Observable<Array<ItemRequest>>;

  categories: Array<Category> = [];
  isCategoryLoading: boolean = true;
  subscriptions: Array<Subscription> = new Array();
  listItem: Array<ItemRequest> = [];
  counter: number = 3;
  isInvalidGuest: boolean = false;
  loadData$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  hasProducts: boolean = false;
  productsLoading: boolean = false;

  constructor(private userService: UserService, private guestUserService: GuestUserService,
    private categoryService: CategoryService, private productService: ProductService) {
  }

  ngOnInit() {
    this.subscriptions.push(this.guestUserService.isValidUser().subscribe(isValid => {
      this.loadData$.next(true);
      if (!isValid) {
        this.isInvalidGuest = true;
        const interval = setInterval(() => {
          this.counter--;
          if (this.counter <= 1) {
            clearInterval(interval);
            this.userService.login();
          }
        }, 1000);
      }
    }));
    this.isCategoryLoading = true;
    this.productsLoading = true;

    this.subscriptions.push(
      // Load first 7 categories to populate home page content and footer navigation
      this.categoryService.retrieveCategories(1, 7)
        .pipe(
          switchMap((categories) => {
            this.categories = Array.isArray(categories) ? categories : [];
            this.isCategoryLoading = false;

            if (this.categories.length > 0) {
              // Load products if categories exist
              this.productListA$ = this.productService.getProducts([get(this.categories[0], 'Id')], 5, 1).pipe(map(results => this.createItemRequest(get(results, 'Products'))));
              this.productListB$ = this.categories.length > 1 ? this.productService.getProducts([get(this.categories[1], 'Id')], 5, 1).pipe(map(results => this.createItemRequest(get(results, 'Products')))) : of([]);

              // Return combined product observables
              return combineLatest([this.productListA$, this.productListB$]);
            } else {
              this.hasProducts = false;
              this.productsLoading = false;
              return of([[], []]);
            }
          }),
          take(1)
        )
        .subscribe(([productsA, productsB]) => {
          if (this.categories.length > 0) {
            this.hasProducts = (productsA && productsA.length > 0) || (productsB && productsB.length > 0);
            this.productsLoading = false;
          }
        })
    );
  }

  createItemRequest(products: Array<Product>): Array<ItemRequest> {
    this.listItem = [];
    forEach(products, product => {
      const itemReq = {
        Product: product,
        Quantity: 1,
        Id: get(product, 'Id')
      } as ItemRequest
      this.listItem.push(itemReq)
    })
    return this.listItem
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
