import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ListController } from '../../core/list-controller';

@Component({
  selector: 'app-table-toolbar',
  imports: [FormsModule],
  templateUrl: './table-toolbar.html',
  styleUrl: './table-toolbar.scss',
})
export class TableToolbar {
  @Input({ required: true }) controller!: ListController<unknown>;
  @Input() slot: 'top' | 'bottom' = 'top';

  onSearchInput(value: string): void {
    this.controller.setSearch(value);
  }

  onPerPageChange(value: string): void {
    this.controller.setPerPage(Number(value));
  }
}
