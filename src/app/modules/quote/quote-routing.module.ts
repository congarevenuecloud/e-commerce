/**
 * Conga Digital Commerce
 *
 * Dedicated routing module for the Quote module
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { CreateQuoteComponent } from './layout/quote-create/create-quote.component';
import { QuoteDetailsComponent } from './layout/quote-details/quote-details.component';

const routes: Routes = [
  {
    path: 'create',
    component: CreateQuoteComponent
  },
  {
    path: ':id',
    component: QuoteDetailsComponent,
  },
  {
    path: '',
    redirectTo: '/my-account/quotes',
    pathMatch: 'prefix'
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class QuoteRoutingModule { }
