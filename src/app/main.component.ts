import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { PageErrorService } from '@congarevenuecloud/ecommerce';

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

  constructor(private pageErrorService: PageErrorService) { }

  ngOnInit() {
    this.pageErrorService.getPageErrorCode().pipe(take(1)).subscribe((res) => {
      this.pageErrorCode = res;
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
