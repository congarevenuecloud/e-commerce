import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { get } from 'lodash';
import { ConfigurationService, FilterOperator } from '@congarevenuecloud/core';
import { ProductService, Product, FieldFilter } from '@congarevenuecloud/ecommerce';
import { ProductDrawerService, BatchSelectionService } from '@congarevenuecloud/elements';

@Component({
  selector: 'app-compare-layout',
  templateUrl: './compare-layout.component.html',
  styleUrls: ['./compare-layout.component.scss']
})
export class CompareLayoutComponent implements OnInit, OnDestroy {
  products: Array<Product>;
  identifiers: Array<string>;
  identifier: string = 'Id';

  constructor(private config: ConfigurationService, private activatedRoute: ActivatedRoute, private router: Router, private productService: ProductService, private batchSelectionService: BatchSelectionService, private productDrawerService: ProductDrawerService) {
    this.identifier = this.config.get('productIdentifier');
  }

  private subs: Array<any> = [];

  ngOnInit() {
    let newIdentifiers = null;
    this.subs.push(this.activatedRoute.queryParams.pipe(
      switchMap(params => {
        newIdentifiers = decodeURIComponent(get(params, 'products')).split(',');
        const filter = [{
          field: this.identifier,
          value: newIdentifiers,
          filterOperator: FilterOperator.IN
        }] as Array<FieldFilter>;
        return this.productService.getProducts(null, null, null, null, null, null, null, null, filter);
      }),
      map(res => {
        const tableProducts = res.Products;
        this.products = tableProducts;
        this.batchSelectionService.setSelectedProducts(tableProducts);
        if (newIdentifiers.length < 2) this.router.navigateByUrl('/');
        this.identifiers = tableProducts.map(product => product[this.identifier]);
        this.productDrawerService.closeDrawer();
        // Wait for product drawer subscription to fire to close drawer if on the compare page.
        setTimeout(() => {
          this.productDrawerService.closeDrawer();
        }, 0);
      })
    ).subscribe());
  }

  ngOnDestroy() {
    if (this.subs && this.subs.length > 0) {
      this.subs.forEach(sub => sub.unsubscribe());
    }
  }
}
