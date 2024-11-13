import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { get } from 'lodash';
import { ProductConfigurationService } from '@congarevenuecloud/elements';
import { ProductDetailComponent } from '../modules/products/detail/product-detail.component';

@Injectable({
  providedIn: 'root',
})
export class ConfigureGuard {

  constructor(private productConfigService: ProductConfigurationService) { }
  canDeactivate(
    component: ProductDetailComponent
  ): Observable<boolean> | Promise<boolean> | boolean {
    if (get(component, 'unsavedConfiguration')) {
      if (confirm('There are unsaved changes in progress in your configuration. Do you want to discard these changes?')) {
        this.productConfigService.unsavedConfiguration.next(false);
        return of(true);
      } else
        return of(false);
    }
    return of(true);
  }
}
