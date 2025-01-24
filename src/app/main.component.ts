import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { NavigationInterceptorService, PageErrorService } from '@congarevenuecloud/ecommerce';

@Component({
  selector: 'app-main',
  template: `
    <app-header></app-header>
    <main *ngIf="!pageErrorCode; else errorPage">
      <router-outlet></router-outlet>
    </main>
    <ng-template #errorPage>
      <apt-error-page [errorMessage]="'ERROR.INVALID_STOREFRONT'"></apt-error-page>
    </ng-template>
  `,
  styles: [
    `
      main{
        min-height: calc(100vh - 108px);
        display: flex;
        flex-direction: column;
      }
      main>*:not(router-outlet){
        flex: 1 1 auto !important;
        flex-direction: column;
        display: flex;
      }
    `
  ],
  encapsulation: ViewEncapsulation.None
})
export class MainComponent implements OnInit {

  subscriptions: Array<Subscription> = new Array();
  pageErrorCode: number = null;

  constructor(private route: ActivatedRoute, private navigationInterceptorService: NavigationInterceptorService, private pageErrorService: PageErrorService) { }

  ngOnInit() {
    this.subscriptions.push(this.route.paramMap.subscribe(params => {
      this.navigationInterceptorService.updateRouteParam(params, 'storefront');
    }));
    this.pageErrorService.getPageErrorCode().pipe(take(1)).subscribe((res) => {
      this.pageErrorCode = res;
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
