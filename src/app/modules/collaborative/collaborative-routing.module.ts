import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CollaborativeCartComponent } from './layout/collaborative-cart/collaborative-cart.component';

const routes: Routes = [
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
