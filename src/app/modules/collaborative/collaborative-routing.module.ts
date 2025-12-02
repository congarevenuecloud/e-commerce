import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CollaborativeQuoteDetailsComponent } from './layout/collaborative-quote/collaborative-quote-details.component';
import { CollaborativeCartComponent } from './layout/collaborative-cart/collaborative-cart.component';
import { CollaborativeQuoteAccessGuard } from './guards/collaborative-quote-access.guard';

const routes: Routes = [
  {
    path: 'proposals/:id',
    component: CollaborativeQuoteDetailsComponent,
    canActivate: [CollaborativeQuoteAccessGuard],
  },
  {
    path: 'cart',
    component: CollaborativeCartComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CollaborativeRoutingModule { }
