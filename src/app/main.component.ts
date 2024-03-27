import { Component, OnInit, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-main',
  template: `
    <app-header></app-header>
    <main>
      <router-outlet></router-outlet>
    </main>
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

  constructor() { }

  ngOnInit() {
  }

}
